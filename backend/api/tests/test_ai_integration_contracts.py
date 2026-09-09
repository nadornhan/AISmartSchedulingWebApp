from datetime import UTC, datetime

import pytest
from pydantic import BaseModel

from app.ai.contracts import (
    AIInvocationContext,
    AIProposalEnvelope,
    candidate_score_evidence,
    task_score_evidence,
)
from app.ai.policies import AIFeature, get_ai_feature_policy
from app.ai.routing import (
    AIRouteReason,
    TaskParserAssessment,
    decide_task_understanding_route,
)
from app.ai.schemas import AIGenerationMetadata
from app.scoring.schemas import CandidateScoreBreakdown, FactorResult, ScoreBreakdown


@pytest.mark.parametrize(
    ("assessment", "reason"),
    [
        (TaskParserAssessment(succeeded=False, confidence=0), AIRouteReason.PARSER_FAILED),
        (
            TaskParserAssessment(succeeded=True, confidence=0.9, missing_fields=["due_date"]),
            AIRouteReason.MISSING_FIELDS,
        ),
        (
            TaskParserAssessment(succeeded=True, confidence=0.9, has_multiple_intents=True),
            AIRouteReason.MULTIPLE_INTENTS,
        ),
        (
            TaskParserAssessment(succeeded=True, confidence=0.5),
            AIRouteReason.LOW_CONFIDENCE,
        ),
        (
            TaskParserAssessment(succeeded=True, confidence=1, explicit_ai_request=True),
            AIRouteReason.EXPLICIT_AI_REQUEST,
        ),
        (
            TaskParserAssessment(succeeded=True, confidence=1, decomposition_requested=True),
            AIRouteReason.DECOMPOSITION_REQUESTED,
        ),
    ],
)
def test_task_routing_calls_ai_only_for_registered_reasons(
    assessment: TaskParserAssessment,
    reason: AIRouteReason,
) -> None:
    decision = decide_task_understanding_route(assessment, ai_enabled=True)

    assert decision.use_ai is True
    assert decision.reason == reason
    assert decision.confidence_threshold == 0.75


def test_task_routing_keeps_clear_input_on_deterministic_parser() -> None:
    decision = decide_task_understanding_route(
        TaskParserAssessment(succeeded=True, confidence=0.9),
        ai_enabled=True,
    )

    assert decision.use_ai is False
    assert decision.reason == AIRouteReason.DETERMINISTIC_PARSE_SUFFICIENT


def test_task_routing_falls_back_to_parser_when_ai_is_disabled() -> None:
    decision = decide_task_understanding_route(
        TaskParserAssessment(succeeded=False, confidence=0),
        ai_enabled=False,
    )

    assert decision.use_ai is False
    assert decision.reason == AIRouteReason.AI_DISABLED


def test_feature_registry_preserves_product_safety_rules() -> None:
    rescheduling = get_ai_feature_policy(AIFeature.INTELLIGENT_RESCHEDULING)
    analytics = get_ai_feature_policy(AIFeature.WEEKLY_INSIGHTS)

    assert rescheduling.invocation == "engine_explanation"
    assert rescheduling.deterministic_authority is True
    assert rescheduling.requires_confirmation is True
    assert analytics.invocation == "weekly_batch"
    assert analytics.deterministic_authority is True


def test_scoring_adapters_publish_versioned_backend_evidence() -> None:
    task_evidence = task_score_evidence(
        ScoreBreakdown(
            profile_name="scheduling",
            scoring_version="v7",
            factors=(
                FactorResult(
                    name="deadline_urgency",
                    score=0.8,
                    weight=0.5,
                    reason="Due soon",
                ),
            ),
            weighted_score=0.4,
            focus_bonus=0.1,
            final_score=0.5,
        )
    )
    candidate_evidence = candidate_score_evidence(
        CandidateScoreBreakdown(
            profile_name="scheduling",
            scoring_version="v7",
            task_importance_score=0.5,
            task_importance_profile="scheduling:v7",
            duration_slot_fit_score=1,
            required_minutes=60,
            window_minutes=60,
            focus_slot_fit_score=0.8,
            focus_peak_hour=10,
            candidate_hour=10,
        )
    )
    context = AIInvocationContext(
        requested_at=datetime(2026, 9, 9, tzinfo=UTC),
        timezone="Australia/Sydney",
        scoring=[task_evidence, candidate_evidence],
    )

    assert context.schema_version == "ai-context-v1"
    assert context.scoring[0].scoring_version == "v7"
    assert context.scoring[1].required_minutes == 60


def test_shared_proposal_contract_is_always_a_preview() -> None:
    class Draft(BaseModel):
        title: str

    envelope = AIProposalEnvelope[Draft](
        feature=AIFeature.TASK_DECOMPOSITION,
        prompt_version="task-decomposition-v1",
        generated_at=datetime(2026, 9, 9, tzinfo=UTC),
        proposal=Draft(title="Research sources"),
        metadata=AIGenerationMetadata(
            feature=AIFeature.TASK_DECOMPOSITION,
            prompt_version="task-decomposition-v1",
            source="fake",
            model="fake",
            latency_ms=1,
        ),
    )

    assert envelope.status == "preview"
    assert envelope.requires_confirmation is True
    assert envelope.context_schema_version == "ai-context-v1"
