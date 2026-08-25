import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.dashboard.schemas import DashboardTaskSummary


class AiWeightsSnapshot(BaseModel):
    deadline_urgency: int = Field(ge=0, le=100)
    priority: int = Field(ge=0, le=100)
    estimated_duration: int = Field(ge=0, le=100)
    ai_assistant_enabled: bool = True
    work_start: str
    work_end: str
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


class SchedulingPlanResponse(BaseModel):
    recommendation: AiRecommendationResponse | None
    schedule: list[ScheduleSuggestionResponse]
    generated_at: datetime
    footnote: str = "AI based on your patterns"


class ScheduleAdjustRequest(BaseModel):
    suggested_start: datetime
    suggested_end: datetime


class ApplyScheduleRequest(BaseModel):
    suggestion_ids: list[uuid.UUID] | None = None
