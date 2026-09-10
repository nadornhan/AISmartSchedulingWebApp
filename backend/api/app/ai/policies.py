from __future__ import annotations

from enum import StrEnum
from types import MappingProxyType
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AIFeature(StrEnum):
    SCHEDULE_PREVIEW = "schedule_preview"
    TASK_UNDERSTANDING = "task_understanding"
    TASK_DECOMPOSITION = "task_decomposition"
    DURATION_ESTIMATION = "duration_estimation"
    PRIORITY_SUGGESTION = "priority_suggestion"
    INTELLIGENT_RESCHEDULING = "intelligent_rescheduling"
    WEEKLY_INSIGHTS = "weekly_insights"


class AIFeaturePolicy(BaseModel):
    model_config = ConfigDict(frozen=True)

    feature: AIFeature
    prompt_version: str = Field(min_length=1, max_length=64)
    invocation: Literal[
        "hybrid_parser",
        "explicit_preview",
        "engine_explanation",
        "weekly_batch",
    ]
    requires_confirmation: bool
    deterministic_authority: bool
    parser_confidence_threshold: float | None = Field(default=None, ge=0, le=1)
    owner_area: str


_POLICIES = {
    AIFeature.SCHEDULE_PREVIEW: AIFeaturePolicy(
        feature=AIFeature.SCHEDULE_PREVIEW,
        prompt_version="schedule-preview-v1",
        invocation="engine_explanation",
        requires_confirmation=True,
        deterministic_authority=True,
        owner_area="scheduling",
    ),
    AIFeature.TASK_UNDERSTANDING: AIFeaturePolicy(
        feature=AIFeature.TASK_UNDERSTANDING,
        prompt_version="task-understanding-v1",
        invocation="hybrid_parser",
        requires_confirmation=True,
        deterministic_authority=False,
        parser_confidence_threshold=0.75,
        owner_area="tasks",
    ),
    AIFeature.TASK_DECOMPOSITION: AIFeaturePolicy(
        feature=AIFeature.TASK_DECOMPOSITION,
        prompt_version="task-decomposition-v1",
        invocation="explicit_preview",
        requires_confirmation=True,
        deterministic_authority=False,
        owner_area="tasks",
    ),
    AIFeature.DURATION_ESTIMATION: AIFeaturePolicy(
        feature=AIFeature.DURATION_ESTIMATION,
        prompt_version="duration-estimation-v1",
        invocation="explicit_preview",
        requires_confirmation=True,
        deterministic_authority=True,
        owner_area="tasks-focus",
    ),
    AIFeature.PRIORITY_SUGGESTION: AIFeaturePolicy(
        feature=AIFeature.PRIORITY_SUGGESTION,
        prompt_version="priority-suggestion-v1",
        invocation="explicit_preview",
        requires_confirmation=True,
        deterministic_authority=True,
        owner_area="priority",
    ),
    AIFeature.INTELLIGENT_RESCHEDULING: AIFeaturePolicy(
        feature=AIFeature.INTELLIGENT_RESCHEDULING,
        prompt_version="rescheduling-explanation-v1",
        invocation="engine_explanation",
        requires_confirmation=True,
        deterministic_authority=True,
        owner_area="scheduling-calendar",
    ),
    AIFeature.WEEKLY_INSIGHTS: AIFeaturePolicy(
        feature=AIFeature.WEEKLY_INSIGHTS,
        prompt_version="weekly-insights-v1",
        invocation="weekly_batch",
        requires_confirmation=False,
        deterministic_authority=True,
        owner_area="analytics",
    ),
}

AI_FEATURE_POLICIES = MappingProxyType(_POLICIES)


def get_ai_feature_policy(feature: AIFeature) -> AIFeaturePolicy:
    return AI_FEATURE_POLICIES[feature]
