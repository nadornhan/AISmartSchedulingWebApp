import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NotificationTaskSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    project_id: uuid.UUID | None
    project_name: str | None = None
    priority: str
    status: str


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID | None
    type: str
    title: str
    message: str | None
    metadata: dict[str, object] | None = None
    scheduled_for: datetime | None
    dedupe_key: str | None
    is_read: bool = Field(validation_alias="is_read")
    read_at: datetime | None
    created_at: datetime
    task: NotificationTaskSummary | None = None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int
