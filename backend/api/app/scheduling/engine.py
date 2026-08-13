from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from collections import Counter

from app.settings.models import UserSettings
from app.tasks.models import Task, TaskPriority
from app.tasks.overdue import is_task_overdue, normalize_due_datetime


PRIORITY_SCORE = {
    TaskPriority.HIGH: 1.0,
    TaskPriority.MEDIUM: 0.7,
    TaskPriority.LOW: 0.4,
    TaskPriority.NO_PRIORITY: 0.2,
}


@dataclass(frozen=True)
class RankedTask:
    task: Task
    score: float
    reasons: list[str]
    based_on: list[str]


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def deadline_score(task: Task, *, now: datetime) -> tuple[float, str | None]:
    if task.due_date is None:
        return 0.25, None

    due = normalize_due_datetime(task.due_date)
    hours = (due - now.astimezone(UTC)).total_seconds() / 3600

    if is_task_overdue(status=task.status, due_date=task.due_date, now=now):
        return 1.0, "Overdue deadline"
    if hours <= 24:
        return 0.95, "Due within 24 hours"
    if hours <= 72:
        return 0.75, "Due within 3 days"
    if hours <= 168:
        return 0.55, "Due this week"
    return 0.35, "Upcoming deadline"


def duration_score(task: Task) -> tuple[float, str | None]:
    minutes = task.estimated_duration_minutes
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


def rank_open_tasks(
    tasks: list[Task],
    settings: UserSettings,
    *,
    now: datetime,
    preferred_focus_hours: Counter[int],
    dismissed_task_ids: set,
) -> list[RankedTask]:
    deadline_w = settings.ai_deadline_urgency_weight / 100
    priority_w = settings.ai_priority_weight / 100
    duration_w = settings.ai_estimated_duration_weight / 100
    weight_sum = max(deadline_w + priority_w + duration_w, 0.01)

    ranked: list[RankedTask] = []

    for task in tasks:
        if task.id in dismissed_task_ids:
            continue

        d_score, d_reason = deadline_score(task, now=now)
        p_score = PRIORITY_SCORE[task.priority]
        dur_score, dur_reason = duration_score(task)
        hour_bonus = focus_hour_bonus(
            preferred_focus_hours,
            candidate_hour=now.astimezone(UTC).hour,
        )

        weighted = (
            (d_score * deadline_w)
            + (p_score * priority_w)
            + (dur_score * duration_w)
        ) / weight_sum
        score = _clamp01(weighted + hour_bonus)

        reasons: list[str] = []
        if d_reason:
            reasons.append(d_reason)
        if task.priority == TaskPriority.HIGH:
            reasons.append("High priority")
        elif task.priority == TaskPriority.MEDIUM:
            reasons.append("Medium priority")
        if dur_reason:
            reasons.append(dur_reason)
        if hour_bonus > 0:
            reasons.append("Matches your usual focus hours")

        based_on = [
            f"Deadline urgency weight ({settings.ai_deadline_urgency_weight})",
            f"Priority weight ({settings.ai_priority_weight})",
            f"Estimated duration weight ({settings.ai_estimated_duration_weight})",
            f"Work hours {settings.work_start.strftime('%H:%M')}"
            f"-{settings.work_end.strftime('%H:%M')}",
        ]
        if preferred_focus_hours:
            top_hour = preferred_focus_hours.most_common(1)[0][0]
            based_on.append(f"Focus pattern peak around {top_hour:02d}:00")
        based_on.append("Task history and open deadlines")

        ranked.append(
            RankedTask(
                task=task,
                score=round(score, 4),
                reasons=reasons or ["Balanced fit for your preferences"],
                based_on=based_on,
            )
        )

    ranked.sort(key=lambda item: (-item.score, str(item.task.id)))
    return ranked


def build_schedule_slots(
    ranked: list[RankedTask],
    settings: UserSettings,
    *,
    now: datetime,
    max_slots: int = 5,
) -> list[tuple[Task, datetime, datetime, str]]:
    if not ranked:
        return []

    day = now.astimezone(UTC).date()
    cursor = datetime.combine(day, settings.work_start, tzinfo=UTC)
    work_end = datetime.combine(day, settings.work_end, tzinfo=UTC)
    if cursor < now.astimezone(UTC):
        # Snap to next 15-minute boundary after now within the workday.
        snapped = now.astimezone(UTC).replace(second=0, microsecond=0)
        extra = (15 - snapped.minute % 15) % 15
        cursor = max(cursor, snapped + timedelta(minutes=extra))

    slots: list[tuple[Task, datetime, datetime, str]] = []
    for item in ranked:
        if len(slots) >= max_slots:
            break
        if cursor >= work_end:
            break

        duration = item.task.estimated_duration_minutes or settings.pomodoro_minutes
        duration = max(15, min(duration, 120))
        start = cursor
        end = start + timedelta(minutes=duration)
        if end > work_end:
            break

        explanation = (
            f"Scheduled using your work hours and "
            f"{'deadline urgency' if settings.ai_deadline_urgency_weight >= settings.ai_priority_weight else 'priority'} "
            f"preference."
        )
        slots.append((item.task, start, end, explanation))
        cursor = end + timedelta(minutes=5)

    return slots
