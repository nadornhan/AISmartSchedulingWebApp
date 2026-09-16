from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time, timedelta

from app.scoring.schemas import ConstraintResult, ConstraintValidationResult
from app.settings.models import UserSettings, effective_daily_work_limit_minutes
from app.tasks.models import Task, TaskStatus
from app.tasks.overdue import normalize_due_datetime
from app.timezones import user_timezone


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
    timezone = user_timezone(getattr(settings, "timezone", None))
    local_start = start.astimezone(timezone)
    local_end = end.astimezone(timezone)
    if (
        local_start.date() != local_end.date()
        or local_start.time() < settings.work_start
        or local_end.time() > settings.work_end
    ):
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


def _minutes_on_local_date(
    *,
    start: datetime,
    end: datetime,
    local_date: date,
    timezone_name: str | None,
) -> int:
    timezone = user_timezone(timezone_name)
    day_start = datetime.combine(local_date, time.min, tzinfo=timezone).astimezone(UTC)
    day_end = datetime.combine(
        local_date + timedelta(days=1),
        time.min,
        tzinfo=timezone,
    ).astimezone(UTC)
    overlap_start = max(normalize_schedule_datetime(start), day_start)
    overlap_end = min(normalize_schedule_datetime(end), day_end)
    if overlap_end <= overlap_start:
        return 0
    return int((overlap_end - overlap_start).total_seconds() // 60)


def scheduled_work_minutes_for_date(
    *,
    local_date: date,
    settings: UserSettings,
    existing_tasks: list[Task],
    existing_candidates: list[tuple[uuid.UUID, datetime, datetime]] | None = None,
    exclude_task_id: uuid.UUID | None = None,
) -> int:
    minutes = sum(
        _minutes_on_local_date(
            start=task.scheduled_start,
            end=task.scheduled_end,
            local_date=local_date,
            timezone_name=getattr(settings, "timezone", None),
        )
        for task in existing_tasks
        if task.status != TaskStatus.DONE
        and task.id != exclude_task_id
        and task.scheduled_start is not None
        and task.scheduled_end is not None
    )
    minutes += sum(
        _minutes_on_local_date(
            start=start,
            end=end,
            local_date=local_date,
            timezone_name=getattr(settings, "timezone", None),
        )
        for candidate_id, start, end in existing_candidates or []
        if candidate_id != exclude_task_id
    )
    return minutes


def is_within_daily_work_limit(
    *,
    task: Task,
    start: datetime,
    end: datetime,
    settings: UserSettings,
    existing_tasks: list[Task],
    existing_candidates: list[tuple[uuid.UUID, datetime, datetime]] | None = None,
) -> ConstraintResult:
    timezone = user_timezone(getattr(settings, "timezone", None))
    local_date = normalize_schedule_datetime(start).astimezone(timezone).date()
    used_minutes = scheduled_work_minutes_for_date(
        local_date=local_date,
        settings=settings,
        existing_tasks=existing_tasks,
        existing_candidates=existing_candidates,
        exclude_task_id=task.id,
    )
    candidate_minutes = int(
        (normalize_schedule_datetime(end) - normalize_schedule_datetime(start)).total_seconds()
        // 60
    )
    limit_minutes = effective_daily_work_limit_minutes(settings)
    if used_minutes + candidate_minutes > limit_minutes:
        return ConstraintResult(
            name="daily_work_limit",
            passed=False,
            reason=(
                f"Daily work limit of {limit_minutes} minutes would be exceeded "
                f"on {local_date.isoformat()}"
            ),
            metadata={
                "local_date": local_date.isoformat(),
                "daily_work_limit_minutes": limit_minutes,
                "scheduled_work_minutes": used_minutes,
                "candidate_minutes": candidate_minutes,
            },
        )
    return ConstraintResult(
        name="daily_work_limit",
        passed=True,
        metadata={
            "local_date": local_date.isoformat(),
            "daily_work_limit_minutes": limit_minutes,
            "scheduled_work_minutes": used_minutes,
            "candidate_minutes": candidate_minutes,
        },
    )


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
        is_within_daily_work_limit(
            task=task,
            start=normalized_start,
            end=normalized_end,
            settings=settings,
            existing_tasks=existing_tasks,
            existing_candidates=existing_candidates,
        ),
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
