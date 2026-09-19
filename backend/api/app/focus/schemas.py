import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.focus.models import FocusSessionStatus
from app.gamification.schemas import RewardFeedback


class FocusSessionCreate(BaseModel):
    task_id: uuid.UUID | None = None
    task_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    started_at: datetime
    ended_at: datetime
    duration_minutes: int = Field(gt=0, le=24 * 60)
    completed: bool = True


class FocusSessionResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID | None
    task_ids: list[uuid.UUID] = Field(default_factory=list)
    started_at: datetime
    ended_at: datetime
    duration_minutes: int
    completed: bool
    growth_reward: RewardFeedback | None = None


class FocusSessionStart(BaseModel):
    task_id: uuid.UUID | None = None
    task_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    planned_duration_minutes: int = Field(gt=0, le=24 * 60)


class FocusSessionProgress(BaseModel):
    actual_duration_seconds: int = Field(ge=0, le=24 * 60 * 60)
    status: FocusSessionStatus


class FocusSessionFinish(BaseModel):
    actual_duration_seconds: int = Field(ge=0, le=24 * 60 * 60)


class FocusSessionDetail(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID | None
    task_ids: list[uuid.UUID] = Field(default_factory=list)
    planned_duration_minutes: int
    actual_duration_seconds: int
    status: FocusSessionStatus
    started_at: datetime
    ended_at: datetime | None
    created_at: datetime
    updated_at: datetime
    growth_reward: RewardFeedback | None = None
