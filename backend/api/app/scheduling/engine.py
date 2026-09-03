from __future__ import annotations

import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.scoring import LegacySchedulingProfile, score_task
from app.scoring.constraints import validate_schedule_candidate
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskPriority


@dataclass(frozen=True)
class RankedTask:
    task: Task
    score: float
    reasons: list[str]
    based_on: list[str]


def rank_open_tasks(
    tasks: list[Task],
    settings: UserSettings,
    *,
    now: datetime,
    preferred_focus_hours: Counter[int],
    dismissed_task_ids: set,
) -> list[RankedTask]:
    profile = LegacySchedulingProfile.from_settings(settings)
    ranked: list[RankedTask] = []

    for task in tasks:
        if task.id in dismissed_task_ids:
            continue

        scored = score_task(
            task,
            profile,
            now=now,
            preferred_focus_hours=preferred_focus_hours,
        )
        factors_by_name = {factor.name: factor for factor in scored.breakdown.factors}

        reasons: list[str] = []
        d_reason = factors_by_name["deadline_urgency"].reason
        if d_reason:
            reasons.append(d_reason)
        if task.priority == TaskPriority.HIGH:
            reasons.append("High priority")
        elif task.priority == TaskPriority.MEDIUM:
            reasons.append("Medium priority")
        dur_reason = factors_by_name["duration_preference"].reason
        if dur_reason:
            reasons.append(dur_reason)
        if scored.breakdown.focus_bonus > 0:
            reasons.append("Matches your usual focus hours")

        based_on = [
            f"Deadline urgency weight ({settings.ai_deadline_urgency_weight})",
            f"Priority weight ({settings.ai_priority_weight})",
            f"Estimated duration weight ({settings.ai_estimated_duration_weight})",
            (
                f"Work hours {settings.work_start.strftime('%H:%M')}"
                f"-{settings.work_end.strftime('%H:%M')}"
            ),
        ]
        if preferred_focus_hours:
            top_hour = preferred_focus_hours.most_common(1)[0][0]
            based_on.append(f"Focus pattern peak around {top_hour:02d}:00")
        based_on.append("Task history and open deadlines")

        ranked.append(
            RankedTask(
                task=task,
                score=scored.score,
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
    existing_tasks: list[Task] | None = None,
    existing_candidates: list[tuple[uuid.UUID, datetime, datetime]] | None = None,
) -> list[tuple[Task, datetime, datetime, str]]:
    if not ranked:
        return []

    blockers = existing_tasks or []
    day = now.astimezone(UTC).date()
    cursor = datetime.combine(day, settings.work_start, tzinfo=UTC)
    work_end = datetime.combine(day, settings.work_end, tzinfo=UTC)
    if cursor < now.astimezone(UTC):
        # Snap to next 15-minute boundary after now within the workday.
        snapped = now.astimezone(UTC).replace(second=0, microsecond=0)
        extra = (15 - snapped.minute % 15) % 15
        cursor = max(cursor, snapped + timedelta(minutes=extra))

    slots: list[tuple[Task, datetime, datetime, str]] = []
    accepted_candidates: list[tuple[uuid.UUID, datetime, datetime]] = list(
        existing_candidates or []
    )
    for item in ranked:
        if len(slots) >= max_slots:
            break
        if cursor >= work_end:
            break

        if item.task.scheduled_start is not None and item.task.scheduled_end is not None:
            continue

        duration = item.task.estimated_duration_minutes or settings.pomodoro_minutes
        duration = max(15, min(duration, 120))
        candidate_cursor = cursor
        chosen: tuple[datetime, datetime] | None = None
        while candidate_cursor < work_end:
            start = candidate_cursor
            end = start + timedelta(minutes=duration)
            validation = validate_schedule_candidate(
                task=item.task,
                start=start,
                end=end,
                settings=settings,
                existing_tasks=blockers,
                existing_candidates=accepted_candidates,
                require_unscheduled_task=True,
            )
            if validation.valid:
                chosen = (start, end)
                break
            if any(
                not check.passed and check.name == "deadline_feasible"
                for check in validation.checks
            ):
                break
            candidate_cursor += timedelta(minutes=15)

        if chosen is None:
            continue

        start, end = chosen

        explanation = (
            f"Scheduled using your work hours and "
            f"{'deadline urgency' if settings.ai_deadline_urgency_weight >= settings.ai_priority_weight else 'priority'} "
            f"preference."
        )
        slots.append((item.task, start, end, explanation))
        accepted_candidates.append((item.task.id, start, end))
        cursor = end + timedelta(minutes=5)

    return slots
