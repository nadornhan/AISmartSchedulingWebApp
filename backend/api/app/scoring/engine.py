from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from typing import Any

from app.scoring.criteria import (
    deadline_urgency,
    duration_preference,
    duration_slot_fit,
    explicit_priority,
    focus_hour_bonus,
    focus_slot_fit,
    scheduling_flexibility_pressure,
    slack_aware_deadline_urgency,
)
from app.scoring.profiles import (
    SchedulingProfileV1,
    SchedulingProfileV2,
    SchedulingProfileV3,
    SchedulingProfileV4,
    SchedulingProfileV5,
    SchedulingProfileV6,
    SchedulingProfileV7,
)
from app.scoring.schemas import (
    CandidateScoreBreakdown,
    FactorResult,
    ScoreBreakdown,
    ScoredCandidate,
    ScoredWindowCandidate,
)
from app.tasks.models import Task
from app.timezones import local_date, local_hour


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def calculate_task_importance(
    task: Task,
    profile: SchedulingProfileV2,
    *,
    now: datetime,
) -> ScoredCandidate:
    deadline_score, deadline_reason = deadline_urgency(
        due_date=task.due_date,
        status=task.status,
        now=now,
    )
    priority_score, priority_reason = explicit_priority(task.priority)
    scores = {
        "deadline_urgency": (deadline_score, deadline_reason),
        "priority": (priority_score, priority_reason),
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

    return ScoredCandidate(
        candidate=task,
        score=round(_clamp01(weighted), 4),
        breakdown=ScoreBreakdown(
            profile_name=profile.profile_name,
            scoring_version="task_importance",
            factors=factors,
            weighted_score=weighted,
            focus_bonus=0.0,
            final_score=round(_clamp01(weighted), 4),
        ),
    )


def calculate_slack_aware_task_importance(
    task: Task,
    profile: SchedulingProfileV5,
    *,
    now: datetime,
    required_minutes: int,
) -> ScoredCandidate:
    deadline_score, deadline_reason, deadline_metadata = slack_aware_deadline_urgency(
        due_date=task.due_date,
        now=now,
        required_minutes=required_minutes,
    )
    priority_score, priority_reason = explicit_priority(task.priority)
    scores = {
        "deadline_urgency": (deadline_score, deadline_reason, deadline_metadata),
        "priority": (priority_score, priority_reason, None),
    }
    factors = tuple(
        FactorResult(
            name=name,
            score=scores[name][0],
            weight=weight,
            reason=scores[name][1],
            metadata=scores[name][2],
        )
        for name, weight in profile.factor_weights().items()
    )

    active_weight_sum = sum(factor.weight for factor in factors)
    if active_weight_sum <= 0:
        weighted = 0.0
    else:
        weighted = (
            sum(factor.score * factor.weight for factor in factors) / active_weight_sum
        )

    return ScoredCandidate(
        candidate=task,
        score=round(_clamp01(weighted), 4),
        breakdown=ScoreBreakdown(
            profile_name=profile.profile_name,
            scoring_version=profile.scoring_version,
            factors=factors,
            weighted_score=weighted,
            focus_bonus=0.0,
            final_score=round(_clamp01(weighted), 4),
        ),
    )


def calculate_capacity_aware_task_importance(
    task: Task,
    profile: SchedulingProfileV7,
    *,
    now: datetime,
    capacity,
) -> ScoredCandidate:
    slack_score, slack_reason, slack_metadata = slack_aware_deadline_urgency(
        due_date=task.due_date,
        now=now,
        required_minutes=capacity.required_minutes,
    )
    pressure_score, pressure_reason, pressure_metadata = scheduling_flexibility_pressure(
        due_date=task.due_date,
        now=now,
        capacity=capacity,
    )
    deadline_score = max(slack_score, pressure_score)
    deadline_reason = pressure_reason if pressure_score > slack_score else slack_reason
    deadline_metadata = {
        "model": "capacity-aware-deadline-pressure",
        "deadline_pressure": round(deadline_score, 4),
        "wall_clock_slack_urgency": round(slack_score, 4),
        "scheduling_flexibility_pressure": round(pressure_score, 4),
        "wall_clock_slack": slack_metadata,
        "scheduling_flexibility": pressure_metadata,
    }

    priority_score, priority_reason = explicit_priority(task.priority)
    scores = {
        "deadline_urgency": (deadline_score, deadline_reason, deadline_metadata),
        "priority": (priority_score, priority_reason, None),
    }
    factors = tuple(
        FactorResult(
            name=name,
            score=scores[name][0],
            weight=weight,
            reason=scores[name][1],
            metadata=scores[name][2],
        )
        for name, weight in profile.factor_weights().items()
    )

    active_weight_sum = sum(factor.weight for factor in factors)
    if active_weight_sum <= 0:
        weighted = 0.0
    else:
        weighted = (
            sum(factor.score * factor.weight for factor in factors) / active_weight_sum
        )

    return ScoredCandidate(
        candidate=task,
        score=round(_clamp01(weighted), 4),
        breakdown=ScoreBreakdown(
            profile_name=profile.profile_name,
            scoring_version=profile.scoring_version,
            factors=factors,
            weighted_score=weighted,
            focus_bonus=0.0,
            final_score=round(_clamp01(weighted), 4),
        ),
    )


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


def score_window_candidate(
    candidate: Any,
    profile: (
        SchedulingProfileV3
        | SchedulingProfileV4
        | SchedulingProfileV5
        | SchedulingProfileV6
        | SchedulingProfileV7
    ),
    *,
    task_importance_score: float,
    preferred_focus_hours: Counter[int] | None = None,
    timezone_name: str | None = None,
) -> ScoredWindowCandidate:
    fit_score, _fit_reason = duration_slot_fit(
        required_minutes=candidate.required_minutes,
        window_minutes=candidate.window.duration_minutes,
    )
    candidate_hour = local_hour(candidate.proposed_start, timezone_name)
    focus_score, _focus_reason, peak_hour = (
        focus_slot_fit(
            preferred_focus_hours or Counter(),
            candidate_hour=candidate_hour,
        )
        if isinstance(
            profile,
            SchedulingProfileV4 | SchedulingProfileV5 | SchedulingProfileV6 | SchedulingProfileV7,
        )
        else (0.0, None, None)
    )

    return ScoredWindowCandidate(
        candidate=candidate,
        task_importance_score=task_importance_score,
        duration_slot_fit_score=round(fit_score, 4),
        focus_slot_fit_score=round(focus_score, 4),
        breakdown=CandidateScoreBreakdown(
            profile_name=profile.profile_name,
            scoring_version=profile.scoring_version,
            task_importance_score=task_importance_score,
            task_importance_profile=(
                f"{profile.task_importance_profile_name}/"
                f"{profile.task_importance_scoring_version}"
            ),
            duration_slot_fit_score=round(fit_score, 4),
            required_minutes=candidate.required_minutes,
            window_minutes=candidate.window.duration_minutes,
            focus_slot_fit_score=round(focus_score, 4),
            focus_peak_hour=peak_hour,
            candidate_hour=candidate_hour,
        ),
    )


def window_candidate_sort_key(scored: ScoredWindowCandidate) -> tuple:
    candidate = scored.candidate
    return (
        -scored.task_importance_score,
        -scored.duration_slot_fit_score,
        -scored.focus_slot_fit_score,
        candidate.proposed_start,
        str(candidate.task.id),
    )


def window_candidate_sort_key_v6(
    scored: ScoredWindowCandidate,
    *,
    timezone_name: str | None = None,
) -> tuple:
    candidate = scored.candidate
    return (
        -scored.task_importance_score,
        local_date(candidate.proposed_start, timezone_name),
        -scored.duration_slot_fit_score,
        -scored.focus_slot_fit_score,
        candidate.proposed_start,
        str(candidate.task.id),
    )
