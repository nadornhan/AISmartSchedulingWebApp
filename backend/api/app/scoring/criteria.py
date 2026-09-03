from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

from app.tasks.models import TaskPriority, TaskStatus
from app.tasks.overdue import is_task_overdue, normalize_due_datetime

PRIORITY_SCORE = {
    TaskPriority.HIGH: 1.0,
    TaskPriority.MEDIUM: 0.7,
    TaskPriority.LOW: 0.4,
    TaskPriority.NO_PRIORITY: 0.2,
}


def deadline_urgency(
    *,
    due_date: datetime | None,
    status: TaskStatus,
    now: datetime,
) -> tuple[float, str | None]:
    if due_date is None:
        return 0.25, None

    due = normalize_due_datetime(due_date)
    hours = (due - now.astimezone(UTC)).total_seconds() / 3600

    if is_task_overdue(status=status, due_date=due_date, now=now):
        return 1.0, "Overdue deadline"
    if hours <= 24:
        return 0.95, "Due within 24 hours"
    if hours <= 72:
        return 0.75, "Due within 3 days"
    if hours <= 168:
        return 0.55, "Due this week"
    return 0.35, "Upcoming deadline"


def explicit_priority(priority: TaskPriority) -> tuple[float, str | None]:
    return PRIORITY_SCORE[priority], None


def duration_preference(minutes: int | None) -> tuple[float, str | None]:
    # This is the legacy short-task preference, not slot-fit scoring.
    if minutes is None:
        return 0.4, None
    if minutes <= 10:
        return 1.0, "Short estimated duration"
    if minutes <= 30:
        return 0.8, "Fits a focused block"
    if minutes <= 60:
        return 0.55, "Medium estimated duration"
    return 0.3, "Longer estimated duration"


def focus_hour_bonus(
    preferred_hours: Counter[int],
    *,
    candidate_hour: int,
) -> float:
    if not preferred_hours:
        return 0.0
    top = preferred_hours.most_common(1)[0][0]
    distance = min(abs(candidate_hour - top), 24 - abs(candidate_hour - top))
    if distance == 0:
        return 0.15
    if distance <= 2:
        return 0.08
    return 0.0
