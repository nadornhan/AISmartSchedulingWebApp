from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.scoring.constraints import normalize_schedule_datetime
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskStatus

DEFAULT_PLANNING_HORIZON_DAYS = 7


@dataclass(frozen=True)
class CandidateWindow:
    start: datetime
    end: datetime

    @property
    def duration_minutes(self) -> int:
        return int((self.end - self.start).total_seconds() // 60)


@dataclass(frozen=True)
class OccupiedInterval:
    start: datetime
    end: datetime
    source_id: uuid.UUID
    source_type: str


@dataclass(frozen=True)
class PlanningHorizon:
    start: datetime
    end: datetime
    days: int


@dataclass(frozen=True)
class WorkingPeriod:
    start: datetime
    end: datetime

    @property
    def as_window(self) -> CandidateWindow:
        return CandidateWindow(start=self.start, end=self.end)


@dataclass(frozen=True)
class TaskCapacitySummary:
    task_id: uuid.UUID
    required_minutes: int
    total_available_minutes: int
    largest_window_minutes: int
    feasible_window_count: int
    has_contiguous_capacity: bool
    earliest_feasible_start: datetime | None = None
    latest_feasible_start: datetime | None = None


@dataclass(frozen=True)
class TaskWindowCandidate:
    task: Task
    window: CandidateWindow
    proposed_start: datetime
    proposed_end: datetime
    required_minutes: int


def scheduling_required_minutes(task: Task, settings: UserSettings) -> int:
    return task.estimated_duration_minutes or settings.pomodoro_minutes or 25


def task_fits_window(task: Task, window: CandidateWindow, settings: UserSettings) -> bool:
    return scheduling_required_minutes(task, settings) <= window.duration_minutes


def build_task_window_candidate(
    *,
    task: Task,
    window: CandidateWindow,
    settings: UserSettings,
) -> TaskWindowCandidate | None:
    required_minutes = scheduling_required_minutes(task, settings)
    if required_minutes > window.duration_minutes:
        return None

    proposed_start = window.start
    proposed_end = proposed_start + timedelta(minutes=required_minutes)
    return TaskWindowCandidate(
        task=task,
        window=window,
        proposed_start=proposed_start,
        proposed_end=proposed_end,
        required_minutes=required_minutes,
    )


def work_window_for_day(*, day, settings: UserSettings) -> CandidateWindow:
    return CandidateWindow(
        start=datetime.combine(day, settings.work_start, tzinfo=UTC),
        end=datetime.combine(day, settings.work_end, tzinfo=UTC),
    )


def planning_horizon(
    *,
    now: datetime,
    days: int = DEFAULT_PLANNING_HORIZON_DAYS,
) -> PlanningHorizon:
    if days < 1:
        raise ValueError("planning horizon must include at least one day")

    start = normalize_schedule_datetime(now)
    return PlanningHorizon(
        start=start,
        end=start + timedelta(days=days),
        days=days,
    )


def working_periods_for_horizon(
    *,
    horizon: PlanningHorizon,
    settings: UserSettings,
) -> list[WorkingPeriod]:
    periods: list[WorkingPeriod] = []
    day = horizon.start.date()
    final_day = horizon.end.date()

    while day <= final_day:
        work_window = work_window_for_day(day=day, settings=settings)
        start = max(work_window.start, horizon.start)
        end = min(work_window.end, horizon.end)
        if end > start:
            periods.append(WorkingPeriod(start=start, end=end))
        day += timedelta(days=1)

    return periods


def derive_free_windows_for_periods(
    *,
    working_periods: list[WorkingPeriod],
    occupied_intervals: list[OccupiedInterval],
) -> list[CandidateWindow]:
    free_windows: list[CandidateWindow] = []
    for period in sorted(working_periods, key=lambda item: item.start):
        free_windows.extend(
            derive_free_windows(
                work_window=period.as_window,
                occupied_intervals=occupied_intervals,
            )
        )

    return free_windows


def candidate_windows_before_deadline(
    *,
    task: Task,
    windows: list[CandidateWindow],
) -> list[CandidateWindow]:
    if task.due_date is None:
        return list(windows)

    deadline = normalize_schedule_datetime(task.due_date)
    clipped: list[CandidateWindow] = []
    for window in windows:
        if window.start >= deadline:
            continue

        clipped_window = CandidateWindow(
            start=window.start,
            end=min(window.end, deadline),
        )
        if clipped_window.end > clipped_window.start:
            clipped.append(clipped_window)

    return clipped


def summarize_task_capacity(
    *,
    task: Task,
    windows: list[CandidateWindow],
    settings: UserSettings,
) -> TaskCapacitySummary:
    required_minutes = scheduling_required_minutes(task, settings)
    candidate_windows = candidate_windows_before_deadline(task=task, windows=windows)
    total_available_minutes = sum(window.duration_minutes for window in candidate_windows)
    largest_window_minutes = max(
        (window.duration_minutes for window in candidate_windows),
        default=0,
    )
    feasible_windows = [
        window
        for window in candidate_windows
        if window.duration_minutes >= required_minutes
    ]

    latest_feasible_start = None
    if feasible_windows:
        latest_feasible_start = max(
            window.end - timedelta(minutes=required_minutes)
            for window in feasible_windows
        )

    return TaskCapacitySummary(
        task_id=task.id,
        required_minutes=required_minutes,
        total_available_minutes=total_available_minutes,
        largest_window_minutes=largest_window_minutes,
        feasible_window_count=len(feasible_windows),
        has_contiguous_capacity=bool(feasible_windows),
        earliest_feasible_start=(
            min(window.start for window in feasible_windows)
            if feasible_windows
            else None
        ),
        latest_feasible_start=latest_feasible_start,
    )


def occupied_intervals_from_tasks(tasks: list[Task]) -> list[OccupiedInterval]:
    intervals: list[OccupiedInterval] = []
    for task in tasks:
        if (
            task.status == TaskStatus.DONE
            or task.scheduled_start is None
            or task.scheduled_end is None
        ):
            continue

        start = normalize_schedule_datetime(task.scheduled_start)
        end = normalize_schedule_datetime(task.scheduled_end)
        if end <= start:
            continue

        intervals.append(
            OccupiedInterval(
                start=start,
                end=end,
                source_id=task.id,
                source_type="task",
            )
        )

    return intervals


def occupied_intervals_from_candidates(
    candidates: list[tuple[uuid.UUID, datetime, datetime]],
) -> list[OccupiedInterval]:
    intervals: list[OccupiedInterval] = []
    for candidate_id, start, end in candidates:
        normalized_start = normalize_schedule_datetime(start)
        normalized_end = normalize_schedule_datetime(end)
        if normalized_end <= normalized_start:
            continue

        intervals.append(
            OccupiedInterval(
                start=normalized_start,
                end=normalized_end,
                source_id=candidate_id,
                source_type="suggestion",
            )
        )

    return intervals


def derive_free_windows(
    *,
    work_window: CandidateWindow,
    occupied_intervals: list[OccupiedInterval],
) -> list[CandidateWindow]:
    clipped = [
        CandidateWindow(
            start=max(interval.start, work_window.start),
            end=min(interval.end, work_window.end),
        )
        for interval in occupied_intervals
        if interval.start < work_window.end and interval.end > work_window.start
    ]
    occupied = _merge_windows(
        [window for window in clipped if window.end > window.start]
    )

    free_windows: list[CandidateWindow] = []
    cursor = work_window.start
    for interval in occupied:
        if cursor < interval.start:
            free_windows.append(CandidateWindow(start=cursor, end=interval.start))
        cursor = max(cursor, interval.end)

    if cursor < work_window.end:
        free_windows.append(CandidateWindow(start=cursor, end=work_window.end))

    return free_windows


def allocate_from_window(
    *,
    windows: list[CandidateWindow],
    used_window: CandidateWindow,
    candidate: TaskWindowCandidate,
) -> list[CandidateWindow]:
    remaining: list[CandidateWindow] = []
    for window in windows:
        if window != used_window:
            remaining.append(window)
            continue

        if candidate.proposed_end < window.end:
            remaining.append(
                CandidateWindow(
                    start=candidate.proposed_end,
                    end=window.end,
                )
            )

    return remaining


def _merge_windows(windows: list[CandidateWindow]) -> list[CandidateWindow]:
    if not windows:
        return []

    ordered = sorted(windows, key=lambda window: window.start)
    merged = [ordered[0]]
    for window in ordered[1:]:
        previous = merged[-1]
        if window.start <= previous.end:
            merged[-1] = CandidateWindow(
                start=previous.start,
                end=max(previous.end, window.end),
            )
        else:
            merged.append(window)

    return merged
