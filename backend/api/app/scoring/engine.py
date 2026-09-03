from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

from app.scoring.criteria import (
    deadline_urgency,
    duration_preference,
    explicit_priority,
    focus_hour_bonus,
)
from app.scoring.profiles import SchedulingProfileV1
from app.scoring.schemas import FactorResult, ScoreBreakdown, ScoredCandidate
from app.tasks.models import Task


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def score_task(
    task: Task,
    profile: SchedulingProfileV1,
    *,
    now: datetime,
    preferred_focus_hours: Counter[int],
) -> ScoredCandidate:
    deadline_score, deadline_reason = deadline_urgency(
        due_date=task.due_date,
        status=task.status,
        now=now,
    )
    priority_score, priority_reason = explicit_priority(task.priority)
    duration_score, duration_reason = duration_preference(
        task.estimated_duration_minutes,
    )

    factors = (
        FactorResult(
            name="deadline_urgency",
            score=deadline_score,
            weight=profile.deadline_weight,
            reason=deadline_reason,
        ),
        FactorResult(
            name="priority",
            score=priority_score,
            weight=profile.priority_weight,
            reason=priority_reason,
        ),
        FactorResult(
            name="duration_preference",
            score=duration_score,
            weight=profile.duration_weight,
            reason=duration_reason,
        ),
    )

    weight_sum = max(sum(factor.weight for factor in factors), 0.01)
    weighted = sum(factor.score * factor.weight for factor in factors) / weight_sum
    hour_bonus = focus_hour_bonus(
        preferred_focus_hours,
        candidate_hour=now.astimezone(UTC).hour,
    )
    final_score = _clamp01(weighted + hour_bonus)

    return ScoredCandidate(
        candidate=task,
        score=round(final_score, 4),
        breakdown=ScoreBreakdown(
            factors=factors,
            weighted_score=weighted,
            focus_bonus=hour_bonus,
            final_score=round(final_score, 4),
        ),
    )
