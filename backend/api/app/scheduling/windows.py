from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.scoring.constraints import normalize_schedule_datetime
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskStatus


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
