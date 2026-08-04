from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import ColumnElement, func

from app.tasks.models import TaskStatus

if TYPE_CHECKING:
    from app.tasks.models import Task


def utc_now() -> datetime:
    return datetime.now(UTC)


def normalize_due_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)


def is_task_overdue(
    *,
    status: TaskStatus,
    due_date: datetime | None,
    now: datetime | None = None,
) -> bool:
    if due_date is None or status == TaskStatus.DONE:
        return False

    reference = now or utc_now()
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=UTC)

    return normalize_due_datetime(due_date) < reference.astimezone(UTC)


def task_overdue_condition(task_model: type[Task]) -> ColumnElement[bool]:
    return (
        (task_model.status != TaskStatus.DONE)
        & task_model.due_date.is_not(None)
        & (task_model.due_date < func.now())
    )
