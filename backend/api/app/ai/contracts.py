from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.ai.schemas import AIGenerationMetadata
from app.scoring.schemas import CandidateScoreBreakdown, ScoreBreakdown

AI_CONTEXT_SCHEMA_VERSION = "ai-context-v1"


class AIScoreFactorEvidence(BaseModel):
    name: str
    score: float
    weight: float
    reason: str | None = None
    metadata: dict[str, Any] | None = None


class AITaskScoreEvidence(BaseModel):
    kind: Literal["task_score"] = "task_score"
    profile_name: str
    scoring_version: str
    final_score: float
    weighted_score: float
    focus_bonus: float
    factors: list[AIScoreFactorEvidence]


class AICandidateScoreEvidence(BaseModel):
    kind: Literal["candidate_score"] = "candidate_score"
    profile_name: str
    scoring_version: str
    task_importance_score: float
    task_importance_profile: str
    duration_slot_fit_score: float
    focus_slot_fit_score: float
    required_minutes: int
    window_minutes: int
    focus_peak_hour: int | None = None
    candidate_hour: int | None = None


AIScoringEvidence = AITaskScoreEvidence | AICandidateScoreEvidence


class AIInvocationContext(BaseModel):
    """Versioned, backend-owned facts that may be supplied to an AI feature."""

    schema_version: Literal["ai-context-v1"] = AI_CONTEXT_SCHEMA_VERSION
    requested_at: datetime
    timezone: str
    locale: str = "en"
    scoring: list[AIScoringEvidence] = Field(default_factory=list)
    facts: dict[str, Any] = Field(default_factory=dict)


class AIProposalEnvelope[ProposalT: BaseModel](BaseModel):
    """Shared preview contract. Feature endpoints must persist only after approval."""

    feature: str
    prompt_version: str
    status: Literal["preview"] = "preview"
    requires_confirmation: Literal[True] = True
    generated_at: datetime
    proposal: ProposalT
    metadata: AIGenerationMetadata
    context_schema_version: Literal["ai-context-v1"] = AI_CONTEXT_SCHEMA_VERSION


def task_score_evidence(breakdown: ScoreBreakdown) -> AITaskScoreEvidence:
    return AITaskScoreEvidence(
        profile_name=breakdown.profile_name,
        scoring_version=breakdown.scoring_version,
        final_score=breakdown.final_score,
        weighted_score=breakdown.weighted_score,
        focus_bonus=breakdown.focus_bonus,
        factors=[
            AIScoreFactorEvidence(
                name=factor.name,
                score=factor.score,
                weight=factor.weight,
                reason=factor.reason,
                metadata=factor.metadata,
            )
            for factor in breakdown.factors
        ],
    )


def candidate_score_evidence(
    breakdown: CandidateScoreBreakdown,
) -> AICandidateScoreEvidence:
    return AICandidateScoreEvidence(
        profile_name=breakdown.profile_name,
        scoring_version=breakdown.scoring_version,
        task_importance_score=breakdown.task_importance_score,
        task_importance_profile=breakdown.task_importance_profile,
        duration_slot_fit_score=breakdown.duration_slot_fit_score,
        focus_slot_fit_score=breakdown.focus_slot_fit_score,
        required_minutes=breakdown.required_minutes,
        window_minutes=breakdown.window_minutes,
        focus_peak_hour=breakdown.focus_peak_hour,
        candidate_hour=breakdown.candidate_hour,
    )
