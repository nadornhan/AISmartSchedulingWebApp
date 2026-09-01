from __future__ import annotations

import uuid
from datetime import UTC, datetime
from itertools import pairwise

from app.settings.models import UserSettings
from app.tasks.models import Task, TaskStatus
from app.tasks.overdue import normalize_due_datetime

from .schemas import GeminiSchedulePreview, GeminiScheduleSlot

MAX_PREVIEW_SLOTS = 5
MIN_SLOT_MINUTES = 15
MAX_SLOT_MINUTES = 120


class DeterministicScheduleValidationError(Exception):
    pass


def validate_ai_preview_schedule(
    *,
    preview: GeminiSchedulePreview,
    requested_tasks: list[Task],
    settings: UserSettings,
    existing_tasks: list[Task] | None = None,
) -> list[GeminiScheduleSlot]:
    if len(preview.schedule) > MAX_PREVIEW_SLOTS:
        raise DeterministicScheduleValidationError("Too many schedule slots")

    requested_by_id = {task.id: task for task in requested_tasks}
    seen_task_ids: set[uuid.UUID] = set()
    accepted_slots: list[GeminiScheduleSlot] = []

    for slot in preview.schedule:
        task = requested_by_id.get(slot.task_id)
        if task is None:
            raise DeterministicScheduleValidationError("Schedule includes an unknown task")
        if slot.task_id in seen_task_ids:
            raise DeterministicScheduleValidationError("Schedule includes duplicate tasks")
        if task.status == TaskStatus.DONE:
            raise DeterministicScheduleValidationError("Completed tasks cannot be scheduled")

        start = _normalize(slot.suggested_start)
        end = _normalize(slot.suggested_end)
        _validate_slot_time(start=start, end=end, task=task, settings=settings)

        accepted_slots.append(
            slot.model_copy(
                update={
                    "suggested_start": start,
                    "suggested_end": end,
                }
            )
        )
        seen_task_ids.add(slot.task_id)

    _validate_no_internal_overlaps(accepted_slots)
    if existing_tasks is not None:
        _validate_no_existing_overlaps(
            accepted_slots=accepted_slots,
            requested_task_ids=set(requested_by_id),
            existing_tasks=existing_tasks,
        )

    return accepted_slots


def _validate_slot_time(
    *,
    start: datetime,
    end: datetime,
    task: Task,
    settings: UserSettings,
) -> None:
    if end <= start:
        raise DeterministicScheduleValidationError(
            "scheduled_end must be later than scheduled_start"
        )

    duration_minutes = int((end - start).total_seconds() // 60)
    expected_duration = _expected_duration_minutes(task, settings)
    if duration_minutes != expected_duration:
        raise DeterministicScheduleValidationError("Schedule duration does not match task duration")

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
        raise DeterministicScheduleValidationError("Schedule is outside work hours")

    if task.due_date is not None and end > normalize_due_datetime(task.due_date):
        raise DeterministicScheduleValidationError("Schedule ends after task deadline")


def _validate_no_internal_overlaps(slots: list[GeminiScheduleSlot]) -> None:
    ordered = sorted(slots, key=lambda slot: _normalize(slot.suggested_start))
    for previous, current in pairwise(ordered):
        if _normalize(current.suggested_start) < _normalize(previous.suggested_end):
            raise DeterministicScheduleValidationError("Schedule contains overlapping slots")


def _validate_no_existing_overlaps(
    *,
    accepted_slots: list[GeminiScheduleSlot],
    requested_task_ids: set[uuid.UUID],
    existing_tasks: list[Task],
) -> None:
    existing_ranges = [
        (
            task.id,
            _normalize(task.scheduled_start),
            _normalize(task.scheduled_end),
        )
        for task in existing_tasks
        if task.status != TaskStatus.DONE
        and task.id not in requested_task_ids
        and task.scheduled_start is not None
        and task.scheduled_end is not None
    ]

    for slot in accepted_slots:
        start = _normalize(slot.suggested_start)
        end = _normalize(slot.suggested_end)
        for _task_id, existing_start, existing_end in existing_ranges:
            if start < existing_end and end > existing_start:
                raise DeterministicScheduleValidationError(
                    "Schedule conflicts with an existing scheduled task"
                )


def _expected_duration_minutes(task: Task, settings: UserSettings) -> int:
    duration = task.estimated_duration_minutes or settings.pomodoro_minutes
    return max(MIN_SLOT_MINUTES, min(duration, MAX_SLOT_MINUTES))


def _normalize(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)
