from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.scoring.schemas import ConstraintResult, ConstraintValidationResult
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskStatus
from app.tasks.overdue import normalize_due_datetime


def normalize_schedule_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)


def intervals_overlap(
    *,
    start: datetime,
    end: datetime,
    existing_start: datetime,
    existing_end: datetime,
) -> bool:
    return start < existing_end and end > existing_start


def is_task_open(task: Task) -> ConstraintResult:
    if task.status == TaskStatus.DONE:
        return ConstraintResult(
            name="task_open",
            passed=False,
            reason="Completed tasks cannot be scheduled",
        )

    return ConstraintResult(name="task_open", passed=True)


def has_valid_interval(*, start: datetime, end: datetime) -> ConstraintResult:
    if end <= start:
        return ConstraintResult(
            name="valid_interval",
            passed=False,
            reason="scheduled_end must be later than scheduled_start",
        )

    return ConstraintResult(name="valid_interval", passed=True)


def is_within_working_hours(
    *,
    start: datetime,
    end: datetime,
    settings: UserSettings,
) -> ConstraintResult:
    work_start = datetime.combine(
        start.date(),
        settings.work_start,
        tzinfo=UTC,
    )
    work_end = datetime.combine(
        start.date(),
        settings.work_end,
        tzinfo=UTC,
    )
    if start < work_start or end > work_end:
        return ConstraintResult(
            name="working_hours",
            passed=False,
            reason="Schedule is outside work hours",
        )

    return ConstraintResult(name="working_hours", passed=True)


def is_deadline_feasible(
    *,
    task: Task,
    end: datetime,
) -> ConstraintResult:
    if task.due_date is not None and end > normalize_due_datetime(task.due_date):
        return ConstraintResult(
            name="deadline_feasible",
            passed=False,
            reason="Schedule ends after task deadline",
        )

    return ConstraintResult(name="deadline_feasible", passed=True)


def has_no_existing_schedule_conflict(
    *,
    task: Task,
    start: datetime,
    end: datetime,
    existing_tasks: list[Task],
) -> ConstraintResult:
    for existing_task in existing_tasks:
        if (
            existing_task.status == TaskStatus.DONE
            or existing_task.id == task.id
            or existing_task.scheduled_start is None
            or existing_task.scheduled_end is None
        ):
            continue

        existing_start = normalize_schedule_datetime(existing_task.scheduled_start)
        existing_end = normalize_schedule_datetime(existing_task.scheduled_end)
        if intervals_overlap(
            start=start,
            end=end,
            existing_start=existing_start,
            existing_end=existing_end,
        ):
            return ConstraintResult(
                name="existing_schedule_conflict",
                passed=False,
                reason="Schedule conflicts with an existing scheduled task",
                metadata={"task_id": str(existing_task.id)},
            )

    return ConstraintResult(name="existing_schedule_conflict", passed=True)


def has_no_candidate_conflict(
    *,
    start: datetime,
    end: datetime,
    existing_candidates: list[tuple[uuid.UUID, datetime, datetime]],
) -> ConstraintResult:
    for candidate_id, existing_start, existing_end in existing_candidates:
        if intervals_overlap(
            start=start,
            end=end,
            existing_start=existing_start,
            existing_end=existing_end,
        ):
            return ConstraintResult(
                name="candidate_schedule_conflict",
                passed=False,
                reason="Schedule conflicts with another active suggestion",
                metadata={"suggestion_id": str(candidate_id)},
            )

    return ConstraintResult(name="candidate_schedule_conflict", passed=True)


def has_no_active_schedule(task: Task) -> ConstraintResult:
    if (
        task.status != TaskStatus.DONE
        and task.scheduled_start is not None
        and task.scheduled_end is not None
    ):
        return ConstraintResult(
            name="active_task_schedule",
            passed=False,
            reason="Task already has an active schedule",
        )

    return ConstraintResult(name="active_task_schedule", passed=True)


def validate_schedule_candidate(
    *,
    task: Task,
    start: datetime,
    end: datetime,
    settings: UserSettings,
    existing_tasks: list[Task],
    existing_candidates: list[tuple[uuid.UUID, datetime, datetime]] | None = None,
    require_unscheduled_task: bool = False,
) -> ConstraintValidationResult:
    normalized_start = normalize_schedule_datetime(start)
    normalized_end = normalize_schedule_datetime(end)
    checks = [
        is_task_open(task),
        has_valid_interval(start=normalized_start, end=normalized_end),
        is_within_working_hours(
            start=normalized_start,
            end=normalized_end,
            settings=settings,
        ),
        is_deadline_feasible(task=task, end=normalized_end),
        has_no_existing_schedule_conflict(
            task=task,
            start=normalized_start,
            end=normalized_end,
            existing_tasks=existing_tasks,
        ),
    ]
    if require_unscheduled_task:
        checks.append(has_no_active_schedule(task))
    if existing_candidates is not None:
        checks.append(
            has_no_candidate_conflict(
                start=normalized_start,
                end=normalized_end,
                existing_candidates=existing_candidates,
            )
        )

    return ConstraintValidationResult(
        valid=all(check.passed for check in checks),
        checks=tuple(checks),
    )
