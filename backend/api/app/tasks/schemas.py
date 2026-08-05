import enum
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.tasks.models import TaskPriority, TaskStatus


class TaskDisplayStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    OVERDUE = "overdue"


class TaskSortBy(str, enum.Enum):
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    TITLE = "title"
    DUE_DATE = "due_date"
    PRIORITY = "priority"


class SortOrder(str, enum.Enum):
    ASC = "asc"
    DESC = "desc"


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str


class SubtaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    is_completed: bool = False
    position: int | None = Field(default=None, ge=0)


class SubtaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    title: str
    is_completed: bool
    position: int
    created_at: datetime
    updated_at: datetime


class SubtaskProgress(BaseModel):
    completed: int = Field(ge=0)
    total: int = Field(ge=0)
    percent: int | None = None


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    project_id: uuid.UUID | None = None
    priority: TaskPriority = TaskPriority.NO_PRIORITY
    due_date: datetime | None = None
    estimated_duration_minutes: int | None = Field(default=None, gt=0)
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    subtasks: list[SubtaskInput] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_schedule(self) -> "TaskCreate":
        if (
            self.scheduled_start is not None
            and self.scheduled_end is not None
            and self.scheduled_end <= self.scheduled_start
        ):
            raise ValueError(
                "scheduled_end must be later than scheduled_start"
            )

        return self


class TaskUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )
    description: str | None = None
    status: TaskStatus | None = None
    project_id: uuid.UUID | None = None
    priority: TaskPriority | None = None
    due_date: datetime | None = None
    estimated_duration_minutes: int | None = Field(default=None, gt=0)
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    subtasks: list[SubtaskInput] | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_schedule(self) -> "TaskUpdate":
        if (
            self.scheduled_start is not None
            and self.scheduled_end is not None
            and self.scheduled_end <= self.scheduled_start
        ):
            raise ValueError(
                "scheduled_end must be later than scheduled_start"
            )

        return self


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID | None
    project: ProjectSummary | None
    title: str
    description: str | None
    status: TaskDisplayStatus = Field(
        validation_alias="display_status",
    )
    priority: TaskPriority
    due_date: datetime | None
    estimated_duration_minutes: int | None
    scheduled_start: datetime | None
    scheduled_end: datetime | None
    completed_at: datetime | None
    subtasks: list[SubtaskResponse]
    subtask_progress: SubtaskProgress
    created_at: datetime
    updated_at: datetime


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
