from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

from app.focus.models import FocusSession, FocusSessionStatus
from app.scoring.constraints import (
    intervals_overlap,
    is_deadline_feasible,
    is_within_working_hours,
    normalize_schedule_datetime,
)
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskStatus

from .engine import free_windows_for_current_state, planning_horizon_for_scheduling
from .windows import (
    OccupiedInterval,
    scheduling_required_minutes,
    summarize_task_capacity,
)

ReschedulingChangeCode = Literal[
    "INVALID_SCHEDULE_INTERVAL",
    "SCHEDULE_CONFLICT",
    "SCHEDULE_DELAYED",
    "TASK_OVERRUN",
    "DURATION_NO_LONGER_FITS",
    "OUTSIDE_WORKING_HOURS",
    "ENDS_AFTER_DEADLINE",
    "CAPACITY_PRESSURE",
]


@dataclass(frozen=True)
class DetectedScheduleChange:
    code: ReschedulingChangeCode
    reason: str
    task_id: uuid.UUID | None = None
    related_task_ids: tuple[uuid.UUID, ...] = ()


@dataclass(frozen=True)
class ReschedulingDetectionResult:
    """A deterministic read-only audit of the user's current scheduling state."""

    changes: tuple[DetectedScheduleChange, ...]
    affected_task_ids: tuple[uuid.UUID, ...]
    movable_task_ids: tuple[uuid.UUID, ...]
    fixed_task_ids: tuple[uuid.UUID, ...]
    additional_fixed_intervals: tuple[OccupiedInterval, ...] = ()

    @property
    def needs_rescheduling(self) -> bool:
        return bool(self.changes)


def _task_id_key(task_id: uuid.UUID) -> str:
    return str(task_id)


def _change_sort_key(change: DetectedScheduleChange) -> tuple:
    return (
        change.code,
        str(change.task_id or ""),
        tuple(map(str, change.related_task_ids)),
    )


def _scheduled_interval(task: Task) -> tuple[datetime, datetime] | None:
    if task.scheduled_start is None or task.scheduled_end is None:
        return None
    return (
        normalize_schedule_datetime(task.scheduled_start),
        normalize_schedule_datetime(task.scheduled_end),
    )


def _detect_task_interval_issues(
    *,
    task: Task,
    settings: UserSettings,
    now: datetime,
) -> list[DetectedScheduleChange]:
    has_start = task.scheduled_start is not None
    has_end = task.scheduled_end is not None
    if not has_start and not has_end:
        return []
    if has_start != has_end:
        return [
            DetectedScheduleChange(
                code="INVALID_SCHEDULE_INTERVAL",
                task_id=task.id,
                reason="Task schedule must include both a start and an end.",
            )
        ]

    interval = _scheduled_interval(task)
    assert interval is not None
    start, end = interval
    if end <= start:
        return [
            DetectedScheduleChange(
                code="INVALID_SCHEDULE_INTERVAL",
                task_id=task.id,
                reason="Task schedule end must be later than its start.",
            )
        ]

    changes: list[DetectedScheduleChange] = []
    if end <= now:
        changes.append(
            DetectedScheduleChange(
                code="SCHEDULE_DELAYED",
                task_id=task.id,
                reason="Open task is still scheduled in a time interval that has ended.",
            )
        )

    scheduled_minutes = int((end - start).total_seconds() // 60)
    required_minutes = scheduling_required_minutes(task, settings)
    if scheduled_minutes < required_minutes:
        changes.append(
            DetectedScheduleChange(
                code="DURATION_NO_LONGER_FITS",
                task_id=task.id,
                reason=(
                    f"Task requires {required_minutes} minutes but its current "
                    f"schedule only reserves {scheduled_minutes} minutes."
                ),
            )
        )

    if not is_within_working_hours(start=start, end=end, settings=settings).passed:
        changes.append(
            DetectedScheduleChange(
                code="OUTSIDE_WORKING_HOURS",
                task_id=task.id,
                reason="Task schedule is outside the current working hours.",
            )
        )

    if not is_deadline_feasible(task=task, end=end).passed:
        changes.append(
            DetectedScheduleChange(
                code="ENDS_AFTER_DEADLINE",
                task_id=task.id,
                reason="Task schedule ends after its current deadline.",
            )
        )

    return changes


def _detect_schedule_conflicts(tasks: list[Task]) -> list[DetectedScheduleChange]:
    scheduled = [
        (task, interval)
        for task in tasks
        if (interval := _scheduled_interval(task)) is not None
        and interval[1] > interval[0]
    ]
    scheduled.sort(key=lambda item: (item[1][0], item[1][1], _task_id_key(item[0].id)))

    changes: list[DetectedScheduleChange] = []
    for index, (task, (start, end)) in enumerate(scheduled):
        for other, (other_start, other_end) in scheduled[index + 1 :]:
            if other_start >= end:
                break
            if not intervals_overlap(
                start=start,
                end=end,
                existing_start=other_start,
                existing_end=other_end,
            ):
                continue

            first, second = sorted((task.id, other.id), key=_task_id_key)
            changes.append(
                DetectedScheduleChange(
                    code="SCHEDULE_CONFLICT",
                    task_id=first,
                    related_task_ids=(second,),
                    reason="Two open tasks have overlapping schedule intervals.",
                )
            )

    return changes


def _detect_capacity_pressure(
    *,
    tasks: list[Task],
    settings: UserSettings,
    now: datetime,
    additional_fixed_intervals: list[OccupiedInterval],
) -> list[DetectedScheduleChange]:
    unscheduled = [
        task
        for task in tasks
        if task.scheduled_start is None and task.scheduled_end is None
    ]
    if not unscheduled:
        return []

    windows = free_windows_for_current_state(
        settings=settings,
        now=now,
        existing_tasks=tasks,
        existing_candidates=[
            (interval.source_id, interval.start, interval.end)
            for interval in additional_fixed_intervals
        ],
    )
    horizon = planning_horizon_for_scheduling(now)
    changes: list[DetectedScheduleChange] = []
    for task in sorted(unscheduled, key=lambda item: _task_id_key(item.id)):
        capacity = summarize_task_capacity(
            task=task,
            windows=windows,
            settings=settings,
        )
        if capacity.has_contiguous_capacity:
            continue

        boundary = (
            f"before its deadline ({task.due_date.isoformat()})"
            if task.due_date is not None
            else f"inside the horizon ending {horizon.end.isoformat()}"
        )
        changes.append(
            DetectedScheduleChange(
                code="CAPACITY_PRESSURE",
                task_id=task.id,
                reason=(
                    f"No contiguous {capacity.required_minutes}-minute window is "
                    f"currently available {boundary}."
                ),
            )
        )

    return changes


def _detect_focus_overruns(
    *,
    tasks: list[Task],
    focus_sessions: list[FocusSession],
) -> tuple[list[DetectedScheduleChange], list[OccupiedInterval]]:
    task_by_id = {task.id: task for task in tasks}
    changes: list[DetectedScheduleChange] = []
    occupied_intervals: list[OccupiedInterval] = []
    active_statuses = {
        FocusSessionStatus.ACTIVE.value,
        FocusSessionStatus.PAUSED.value,
    }

    for session in sorted(focus_sessions, key=lambda item: _task_id_key(item.id)):
        task = task_by_id.get(session.task_id)
        if (
            task is None
            or session.status not in active_statuses
            or session.actual_duration_seconds
            <= session.planned_duration_minutes * 60
        ):
            continue

        interval = _scheduled_interval(task)
        if interval is None:
            continue
        _, scheduled_end = interval
        observed_end = normalize_schedule_datetime(session.started_at) + timedelta(
            seconds=session.actual_duration_seconds
        )
        if observed_end <= scheduled_end:
            continue

        occupied_intervals.append(
            OccupiedInterval(
                start=scheduled_end,
                end=observed_end,
                source_id=session.id,
                source_type="focus_overrun",
            )
        )

        related_ids = tuple(
            sorted(
                (
                    other.id
                    for other in tasks
                    if other.id != task.id
                    and (other_interval := _scheduled_interval(other)) is not None
                    and intervals_overlap(
                        start=scheduled_end,
                        end=observed_end,
                        existing_start=other_interval[0],
                        existing_end=other_interval[1],
                    )
                ),
                key=_task_id_key,
            )
        )
        changes.append(
            DetectedScheduleChange(
                code="TASK_OVERRUN",
                task_id=task.id,
                related_task_ids=related_ids,
                reason=(
                    "Active focus progress has exceeded both its planned duration "
                    "and the task's scheduled end."
                ),
            )
        )

    return changes, occupied_intervals


def detect_rescheduling_needs(
    *,
    tasks: list[Task],
    settings: UserSettings,
    now: datetime,
    focus_sessions: list[FocusSession] | None = None,
) -> ReschedulingDetectionResult:
    """Audit current state without mutating tasks or persisting proposals."""

    normalized_now = normalize_schedule_datetime(now)
    open_tasks = sorted(
        (task for task in tasks if task.status != TaskStatus.DONE),
        key=lambda task: _task_id_key(task.id),
    )
    fixed_ids = {task.id for task in open_tasks if task.schedule_locked}
    movable_ids = {task.id for task in open_tasks if not task.schedule_locked}

    changes: list[DetectedScheduleChange] = []
    for task in open_tasks:
        changes.extend(
            _detect_task_interval_issues(
                task=task,
                settings=settings,
                now=normalized_now,
            )
        )
    changes.extend(_detect_schedule_conflicts(open_tasks))
    overrun_changes, overrun_intervals = _detect_focus_overruns(
        tasks=open_tasks,
        focus_sessions=focus_sessions or [],
    )
    overrun_task_ids = {
        change.task_id for change in overrun_changes if change.task_id is not None
    }
    changes = [
        change
        for change in changes
        if not (change.code == "SCHEDULE_DELAYED" and change.task_id in overrun_task_ids)
    ]
    changes.extend(overrun_changes)
    changes.extend(
        _detect_capacity_pressure(
            tasks=open_tasks,
            settings=settings,
            now=normalized_now,
            additional_fixed_intervals=overrun_intervals,
        )
    )

    unique_changes = sorted(set(changes), key=_change_sort_key)
    affected_ids = {
        task_id
        for change in unique_changes
        for task_id in (
            *((change.task_id,) if change.task_id is not None else ()),
            *change.related_task_ids,
        )
    }

    return ReschedulingDetectionResult(
        changes=tuple(unique_changes),
        affected_task_ids=tuple(sorted(affected_ids, key=_task_id_key)),
        movable_task_ids=tuple(sorted(movable_ids, key=_task_id_key)),
        fixed_task_ids=tuple(sorted(fixed_ids, key=_task_id_key)),
        additional_fixed_intervals=tuple(
            sorted(
                overrun_intervals,
                key=lambda interval: (
                    interval.start,
                    interval.end,
                    _task_id_key(interval.source_id),
                ),
            )
        ),
    )
