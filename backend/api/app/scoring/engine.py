from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

from app.scoring.criteria import (
    deadline_urgency,
    duration_preference,
    explicit_priority,
    focus_hour_bonus,
)
from app.scoring.profiles import SchedulingProfileV1, SchedulingProfileV2
from app.scoring.schemas import FactorResult, ScoreBreakdown, ScoredCandidate
from app.tasks.models import Task


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def score_task(
    task: Task,
    profile: SchedulingProfileV1 | SchedulingProfileV2,
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

    scores = {
        "deadline_urgency": (deadline_score, deadline_reason),
        "priority": (priority_score, priority_reason),
        "duration_preference": (duration_score, duration_reason),
    }
    factors = tuple(
        FactorResult(
            name=name,
            score=scores[name][0],
            weight=weight,
            reason=scores[name][1],
        )
        for name, weight in profile.factor_weights().items()
    )

    active_weight_sum = sum(factor.weight for factor in factors)
    weight_sum = max(active_weight_sum, 0.01)
    weighted = sum(factor.score * factor.weight for factor in factors) / weight_sum
    hour_bonus = (
        focus_hour_bonus(
            preferred_focus_hours,
            candidate_hour=now.astimezone(UTC).hour,
        )
        if profile.should_apply_focus_bonus(active_weight_sum=active_weight_sum)
        else 0.0
    )
    final_score = _clamp01(weighted + hour_bonus)

    return ScoredCandidate(
        candidate=task,
        score=round(final_score, 4),
        breakdown=ScoreBreakdown(
            profile_name=profile.profile_name,
            scoring_version=profile.scoring_version,
            factors=factors,
            weighted_score=weighted,
            focus_bonus=hour_bonus,
            final_score=round(final_score, 4),
        ),
    )
