import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .models import TaskStatus


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    status: TaskStatus | None = None


class TaskRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
