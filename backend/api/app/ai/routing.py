from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from app.ai.policies import AIFeature, get_ai_feature_policy


class AIRouteReason(StrEnum):
    DETERMINISTIC_PARSE_SUFFICIENT = "deterministic_parse_sufficient"
    AI_DISABLED = "ai_disabled"
    PARSER_FAILED = "parser_failed"
    LOW_CONFIDENCE = "low_confidence"
    MISSING_FIELDS = "missing_fields"
    MULTIPLE_INTENTS = "multiple_intents"
    EXPLICIT_AI_REQUEST = "explicit_ai_request"
    DECOMPOSITION_REQUESTED = "decomposition_requested"


class TaskParserAssessment(BaseModel):
    succeeded: bool
    confidence: float = Field(ge=0, le=1)
    missing_fields: list[str] = Field(default_factory=list)
    has_multiple_intents: bool = False
    explicit_ai_request: bool = False
    decomposition_requested: bool = False


class AIInvocationDecision(BaseModel):
    feature: AIFeature
    use_ai: bool
    reason: AIRouteReason
    parser_confidence: float
    confidence_threshold: float


def decide_task_understanding_route(
    assessment: TaskParserAssessment,
    *,
    ai_enabled: bool,
) -> AIInvocationDecision:
    """Choose parser or Gemini without inspecting user text in shared code."""

    policy = get_ai_feature_policy(AIFeature.TASK_UNDERSTANDING)
    threshold = policy.parser_confidence_threshold
    if threshold is None:
        raise RuntimeError("task understanding policy requires a confidence threshold")

    reason = AIRouteReason.DETERMINISTIC_PARSE_SUFFICIENT
    use_ai = False
    if not ai_enabled:
        reason = AIRouteReason.AI_DISABLED
    elif assessment.decomposition_requested:
        reason = AIRouteReason.DECOMPOSITION_REQUESTED
        use_ai = True
    elif assessment.explicit_ai_request:
        reason = AIRouteReason.EXPLICIT_AI_REQUEST
        use_ai = True
    elif not assessment.succeeded:
        reason = AIRouteReason.PARSER_FAILED
        use_ai = True
    elif assessment.missing_fields:
        reason = AIRouteReason.MISSING_FIELDS
        use_ai = True
    elif assessment.has_multiple_intents:
        reason = AIRouteReason.MULTIPLE_INTENTS
        use_ai = True
    elif assessment.confidence < threshold:
        reason = AIRouteReason.LOW_CONFIDENCE
        use_ai = True

    return AIInvocationDecision(
        feature=AIFeature.TASK_UNDERSTANDING,
        use_ai=use_ai,
        reason=reason,
        parser_confidence=assessment.confidence,
        confidence_threshold=threshold,
    )
