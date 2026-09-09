"""Shared AI infrastructure for CHRONO feature modules."""

from app.ai.contracts import (
    AI_CONTEXT_SCHEMA_VERSION,
    AICandidateScoreEvidence,
    AIInvocationContext,
    AIProposalEnvelope,
    AIScoreFactorEvidence,
    AITaskScoreEvidence,
    candidate_score_evidence,
    task_score_evidence,
)
from app.ai.dependencies import get_ai_service
from app.ai.policies import AIFeature, AIFeaturePolicy, get_ai_feature_policy
from app.ai.provider import AIProvider
from app.ai.routing import (
    AIInvocationDecision,
    AIRouteReason,
    TaskParserAssessment,
    decide_task_understanding_route,
)
from app.ai.schemas import AIUsageEvent, AIUsageFeatureSummary
from app.ai.service import AIService
from app.ai.telemetry import (
    AITelemetryRecorder,
    DatabaseAITelemetryRecorder,
    summarize_ai_usage,
)

__all__ = [
    "AI_CONTEXT_SCHEMA_VERSION",
    "AICandidateScoreEvidence",
    "AIFeature",
    "AIFeaturePolicy",
    "AIInvocationContext",
    "AIInvocationDecision",
    "AIProposalEnvelope",
    "AIProvider",
    "AIRouteReason",
    "AIScoreFactorEvidence",
    "AIService",
    "AITaskScoreEvidence",
    "AITelemetryRecorder",
    "AIUsageEvent",
    "AIUsageFeatureSummary",
    "DatabaseAITelemetryRecorder",
    "TaskParserAssessment",
    "candidate_score_evidence",
    "decide_task_understanding_route",
    "get_ai_feature_policy",
    "get_ai_service",
    "summarize_ai_usage",
    "task_score_evidence",
]
