"""Priority API contracts; preview inputs never accept client-calculated scores."""

from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.ai.contracts import AIProposalEnvelope, AITaskScoreEvidence
from app.tasks.models import TaskPriority


class PriorityPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    importance_description: str = Field(default="", max_length=2000)
    importance_level: Literal["low", "medium", "high"] | None = None
    dependency_ids: list[UUID] = Field(default_factory=list, max_length=100)
    include_ai_explanation: bool = True


class DraftPriorityPreviewRequest(PriorityPreviewRequest):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=10000)
    due_date: AwareDatetime | None = None
    estimated_duration_minutes: int | None = Field(default=None, gt=0)
    current_priority: TaskPriority = TaskPriority.NO_PRIORITY


class PriorityProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    suggested_priority: TaskPriority
    confidence: float = Field(ge=0, le=1)
    confidence_basis: Literal["evidence_coverage"] = "evidence_coverage"
    reasons: list[str] = Field(min_length=1)
    missing_inputs: list[str] = Field(default_factory=list)
    scoring: AITaskScoreEvidence
    rules_version: Literal["priority-rules-v1"] = "priority-rules-v1"
    ai_explanation: str | None = Field(default=None, max_length=2000)
    importance_level: Literal["low", "medium", "high"] | None = None
    importance_confidence: float | None = Field(default=None, ge=0, le=1)
    importance_source: Literal["user", "ai", "unavailable"] = "unavailable"
    importance_reason: str | None = None


class PriorityPreviewResponse(AIProposalEnvelope[PriorityProposal]):
    confirmation_token: str | None = None
    expected_updated_at: AwareDatetime | None = None


class PriorityConfirmRequest(BaseModel):
    """Endpoint must recheck ownership/version atomically before applying this choice."""

    model_config = ConfigDict(extra="forbid")

    expected_updated_at: AwareDatetime
    selected_priority: TaskPriority
    action: Literal["accept", "change"]
    confirmation_token: str = Field(min_length=1, max_length=4096)


class PriorityAIExplanation(BaseModel):
    """Gemini may explain evidence, but cannot return a priority or score."""

    model_config = ConfigDict(extra="forbid", strict=True)
    explanation: str = Field(min_length=1, max_length=2000)


class PriorityAIImportance(BaseModel):
    """AI assesses impact only; the deterministic engine owns final priority."""

    model_config = ConfigDict(extra="forbid", strict=True)
    importance_level: Literal["low", "medium", "high"] | None
    confidence: float = Field(ge=0, le=1)
    reason: str = Field(min_length=1, max_length=2000)
