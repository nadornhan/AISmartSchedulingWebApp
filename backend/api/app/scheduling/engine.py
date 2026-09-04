from __future__ import annotations

import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.scheduling.windows import (
    CandidateWindow,
    allocate_from_window,
    build_task_window_candidate,
    candidate_windows_before_deadline,
    derive_free_windows_for_periods,
    occupied_intervals_from_candidates,
    occupied_intervals_from_tasks,
    planning_horizon,
    scheduling_required_minutes,
    summarize_task_capacity,
    working_periods_for_horizon,
)
from app.scoring import (
    SchedulingProfileV5,
    SchedulingProfileV7,
    calculate_capacity_aware_task_importance,
    calculate_slack_aware_task_importance,
    score_window_candidate,
    window_candidate_sort_key_v6,
)
from app.scoring.constraints import validate_schedule_candidate
from app.scoring.criteria import peak_focus_hour
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskPriority


@dataclass(frozen=True)
class RankedTask:
    task: Task
    score: float
    reasons: list[str]
    based_on: list[str]


def _snapped_horizon_start(now: datetime) -> datetime:
    normalized = now.astimezone(UTC)
    snapped = normalized.replace(second=0, microsecond=0)
    extra = (15 - snapped.minute % 15) % 15
    return snapped + timedelta(minutes=extra)


def free_windows_for_current_state(
    *,
    settings: UserSettings,
    now: datetime,
    existing_tasks: list[Task] | None = None,
    existing_candidates: list[tuple[uuid.UUID, datetime, datetime]] | None = None,
) -> list[CandidateWindow]:
    horizon = planning_horizon(now=_snapped_horizon_start(now))
    working_periods = working_periods_for_horizon(
        horizon=horizon,
        settings=settings,
        timezone_name=settings.timezone,
    )
    occupied_intervals = [
        *occupied_intervals_from_tasks(existing_tasks or []),
        *occupied_intervals_from_candidates(existing_candidates or []),
    ]
    return derive_free_windows_for_periods(
        working_periods=working_periods,
        occupied_intervals=occupied_intervals,
    )


def rank_open_tasks(
    tasks: list[Task],
    settings: UserSettings,
    *,
    now: datetime,
    preferred_focus_hours: Counter[int],
    dismissed_task_ids: set,
    capacity_windows: list[CandidateWindow] | None = None,
) -> list[RankedTask]:
    profile = (
        SchedulingProfileV7.from_settings(settings)
        if capacity_windows is not None
        else SchedulingProfileV5.from_settings(settings)
    )
    ranked: list[RankedTask] = []

    for task in tasks:
        if task.id in dismissed_task_ids:
            continue

        if capacity_windows is None:
            scored = calculate_slack_aware_task_importance(
                task,
                profile,
                now=now,
                required_minutes=scheduling_required_minutes(task, settings),
            )
        else:
            scored = calculate_capacity_aware_task_importance(
                task,
                profile,
                now=now,
                capacity=summarize_task_capacity(
                    task=task,
                    windows=capacity_windows,
                    settings=settings,
                ),
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
        dur_factor = factors_by_name.get("duration_preference")
        if dur_factor and dur_factor.reason:
            reasons.append(dur_factor.reason)
        based_on = [
            f"Deadline urgency weight ({settings.ai_deadline_urgency_weight})",
            f"Priority weight ({settings.ai_priority_weight})",
            (
                f"Work hours {settings.work_start.strftime('%H:%M')}"
                f"-{settings.work_end.strftime('%H:%M')}"
            ),
        ]
        if preferred_focus_hours:
            top_hour = peak_focus_hour(preferred_focus_hours)
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
    preferred_focus_hours: Counter[int] | None = None,
) -> list[tuple[Task, datetime, datetime, str]]:
    if not ranked:
        return []

    blockers = existing_tasks or []

    slots: list[tuple[Task, datetime, datetime, str]] = []
    accepted_candidates: list[tuple[uuid.UUID, datetime, datetime]] = list(
        existing_candidates or []
    )
    free_windows = free_windows_for_current_state(
        settings=settings,
        now=now,
        existing_tasks=blockers,
        existing_candidates=accepted_candidates,
    )

    remaining_ranked = [
        item
        for item in ranked
        if not (
            item.task.scheduled_start is not None
            and item.task.scheduled_end is not None
        )
    ]
    placement_profile = SchedulingProfileV7.from_settings(settings)
    focus_hours = preferred_focus_hours or Counter()

    while remaining_ranked:
        if len(slots) >= max_slots:
            break
        if not free_windows:
            break

        scored_candidates = []
        for item in remaining_ranked:
            capacity = summarize_task_capacity(
                task=item.task,
                windows=free_windows,
                settings=settings,
            )
            importance = calculate_capacity_aware_task_importance(
                item.task,
                placement_profile,
                now=now,
                capacity=capacity,
            )
            task_windows = candidate_windows_before_deadline(
                task=item.task,
                windows=free_windows,
            )
            for window in task_windows:
                candidate = build_task_window_candidate(
                    task=item.task,
                    window=window,
                    settings=settings,
                )
                if candidate is None:
                    continue

                validation = validate_schedule_candidate(
                    task=item.task,
                    start=candidate.proposed_start,
                    end=candidate.proposed_end,
                    settings=settings,
                    existing_tasks=blockers,
                    existing_candidates=accepted_candidates,
                    require_unscheduled_task=True,
                )
                if not validation.valid:
                    continue

                scored_candidates.append(
                    score_window_candidate(
                        candidate,
                        placement_profile,
                        task_importance_score=importance.score,
                        preferred_focus_hours=focus_hours,
                        timezone_name=settings.timezone,
                    )
                )

        if not scored_candidates:
            break

        scored = min(
            scored_candidates,
            key=lambda item: window_candidate_sort_key_v6(
                item,
                timezone_name=settings.timezone,
            ),
        )
        candidate = scored.candidate
        window = candidate.window
        start = candidate.proposed_start
        end = candidate.proposed_end

        explanation = (
            f"Scheduled using your work hours and "
            f"{'deadline urgency' if settings.ai_deadline_urgency_weight >= settings.ai_priority_weight else 'priority'} "
            f"preference."
        )
        slots.append((candidate.task, start, end, explanation))
        accepted_candidates.append((candidate.task.id, start, end))
        free_windows = allocate_from_window(
            windows=free_windows,
            used_window=window,
            candidate=candidate,
        )
        remaining_ranked = [
            item
            for item in remaining_ranked
            if item.task.id != candidate.task.id
        ]

    return slots
