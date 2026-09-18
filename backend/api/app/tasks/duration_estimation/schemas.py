from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.ai.contracts import AIProposalEnvelope

# Active working time, including multi-session tasks; not a scheduling slot limit.
MAX_DURATION_MINUTES = 7 * 24 * 60
ALGORITHM_VERSION = "personal-duration-v1"
DurationSource = Literal["ai_prior", "history", "current_estimate", "default"]
DecisionAction = Literal["accepted", "changed", "ignored"]


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GeminiDurationPrior(StrictSchema):
    estimated_duration_minutes: int = Field(strict=True, ge=1, le=MAX_DURATION_MINUTES)
    explanation: str = Field(min_length=1, max_length=500)


class DurationHistorySample(StrictSchema):
    task_id: UUID
    title: str
    description: str | None
    project_id: UUID | None
    estimated_minutes: int | None
    reference_source: str
    actual_minutes: float
    session_count: int
    completed_at: datetime
    completion_lead_minutes: float


class DurationEstimate(StrictSchema):
    suggested_duration_minutes: int = Field(ge=1, le=MAX_DURATION_MINUTES)
    confidence: float = Field(ge=0, le=1)
    historical_sample_count: int = Field(ge=0)
    adjustment_factor: float = Field(gt=0)
    explanation: str
    source: DurationSource
    prior_minutes: int = Field(ge=1, le=MAX_DURATION_MINUTES)
    algorithm_version: Literal["personal-duration-v1"] = ALGORITHM_VERSION


class DurationProposalData(DurationEstimate):
    proposal_id: UUID
    proposal_token: str
    expires_at: datetime


DurationPreviewResponse = AIProposalEnvelope[DurationProposalData]


class DurationConfirmRequest(StrictSchema):
    proposal_token: str = Field(min_length=1, max_length=8192)
    action: DecisionAction
    duration_minutes: int | None = Field(default=None, strict=True, ge=1, le=MAX_DURATION_MINUTES)

    @model_validator(mode="after")
    def validate_action(self):
        if self.action == "changed" and self.duration_minutes is None:
            raise ValueError("duration_minutes is required for changed")
        if self.action != "changed" and self.duration_minutes is not None:
            raise ValueError("duration_minutes is only allowed for changed")
        return self


class DurationConfirmResponse(StrictSchema):
    proposal_id: UUID
    task_id: UUID
    action: DecisionAction
    applied_duration_minutes: int | None
    task_estimated_duration_minutes: int | None
    resolved_at: datetime
