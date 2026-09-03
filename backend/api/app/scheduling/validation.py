from __future__ import annotations

import uuid
from datetime import datetime
from itertools import pairwise

from app.scoring.constraints import (
    has_no_existing_schedule_conflict,
    normalize_schedule_datetime,
    validate_schedule_candidate,
)
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskStatus

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

        start = normalize_schedule_datetime(slot.suggested_start)
        end = normalize_schedule_datetime(slot.suggested_end)
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

    validation = validate_schedule_candidate(
        task=task,
        start=start,
        end=end,
        settings=settings,
        existing_tasks=[],
    )
    if not validation.valid:
        failed = next(check for check in validation.checks if not check.passed)
        raise DeterministicScheduleValidationError(failed.reason or "Invalid schedule")


def _validate_no_internal_overlaps(slots: list[GeminiScheduleSlot]) -> None:
    ordered = sorted(slots, key=lambda slot: normalize_schedule_datetime(slot.suggested_start))
    for previous, current in pairwise(ordered):
        if normalize_schedule_datetime(
            current.suggested_start
        ) < normalize_schedule_datetime(previous.suggested_end):
            raise DeterministicScheduleValidationError("Schedule contains overlapping slots")


def _validate_no_existing_overlaps(
    *,
    accepted_slots: list[GeminiScheduleSlot],
    requested_task_ids: set[uuid.UUID],
    existing_tasks: list[Task],
) -> None:
    for slot in accepted_slots:
        task = next(
            existing_task
            for existing_task in existing_tasks
            if existing_task.id == slot.task_id
        )
        result = has_no_existing_schedule_conflict(
            task=task,
            start=normalize_schedule_datetime(slot.suggested_start),
            end=normalize_schedule_datetime(slot.suggested_end),
            existing_tasks=[
                existing_task
                for existing_task in existing_tasks
                if existing_task.id not in requested_task_ids
            ],
        )
        if not result.passed:
            raise DeterministicScheduleValidationError(result.reason or "Invalid schedule")


def _expected_duration_minutes(task: Task, settings: UserSettings) -> int:
    duration = task.estimated_duration_minutes or settings.pomodoro_minutes
    return max(MIN_SLOT_MINUTES, min(duration, MAX_SLOT_MINUTES))
