import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.dashboard.schemas import DashboardTaskSummary


class AiWeightsSnapshot(BaseModel):
    deadline_urgency: int = Field(ge=0, le=100)
    priority: int = Field(ge=0, le=100)
    estimated_duration: int = Field(ge=0, le=100)
    ai_assistant_enabled: bool = True
    work_start: str
    work_end: str
    timezone: str = "UTC"
    pomodoro_minutes: int


class AiRecommendationResponse(BaseModel):
    id: uuid.UUID
    task: DashboardTaskSummary | None = None
    title: str
    explanation: str
    reasons: list[str]
    based_on: list[str]
    score: float
    status: str
    weights: AiWeightsSnapshot
    generated_at: datetime


class ScheduleSuggestionResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    task_title: str
    project_name: str | None = None
    suggested_start: datetime
    suggested_end: datetime
    explanation: str
    status: str
    position: int


class SchedulingIssueMetadata(BaseModel):
    required_minutes: int
    total_available_minutes: int
    largest_available_block_minutes: int
    feasible_window_count: int
    due_date: str | None = None
    planning_horizon_end: str


class SchedulingIssueResponse(BaseModel):
    task_id: uuid.UUID
    task_title: str
    code: Literal[
        "NO_WINDOW_BEFORE_DEADLINE",
        "NO_CONTIGUOUS_WINDOW_BEFORE_DEADLINE",
        "NO_CAPACITY_IN_HORIZON",
        "NO_CONTIGUOUS_WINDOW_IN_HORIZON",
    ]
    severity: Literal["warning", "critical"]
    reason: str
    metadata: SchedulingIssueMetadata


class SchedulingPlanResponse(BaseModel):
    recommendation: AiRecommendationResponse | None
    schedule: list[ScheduleSuggestionResponse]
    issues: list[SchedulingIssueResponse] = Field(default_factory=list)
    generated_at: datetime
    footnote: str = "AI based on your patterns"


class ScheduleAdjustRequest(BaseModel):
    suggested_start: datetime
    suggested_end: datetime


class ApplyScheduleRequest(BaseModel):
    suggestion_ids: list[uuid.UUID] | None = None


class AiPreviewRequest(BaseModel):
    task_ids: list[uuid.UUID] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def reject_duplicate_task_ids(self) -> "AiPreviewRequest":
        if len(set(self.task_ids)) != len(self.task_ids):
            raise ValueError("task_ids must not contain duplicates")

        return self


class GeminiScheduleSlot(BaseModel):
    task_id: uuid.UUID
    suggested_start: datetime
    suggested_end: datetime
    explanation: str = Field(min_length=1, max_length=500)


class GeminiSchedulePreview(BaseModel):
    schedule: list[GeminiScheduleSlot] = Field(min_length=1, max_length=5)


class AiPreviewSlotResponse(BaseModel):
    task_id: uuid.UUID
    task_title: str
    project_name: str | None = None
    suggested_start: datetime
    suggested_end: datetime
    explanation: str
    position: int


class AiPreviewResponse(BaseModel):
    schedule: list[AiPreviewSlotResponse]
    generated_at: datetime
    model: str
    footnote: str = (
        "Gemini preview only. Review before applying; no database changes were made."
    )
