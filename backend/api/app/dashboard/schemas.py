import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.tasks.models import TaskPriority, TaskStatus
from app.tasks.schemas import ProjectSummary, TaskDisplayStatus


class ProgressSummary(BaseModel):
    completed: int = Field(ge=0)
    total: int = Field(ge=0)
    percent: int | None = None


class DashboardTaskSummary(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    project_id: uuid.UUID | None
    project: ProjectSummary | None
    priority: TaskPriority
    status: TaskDisplayStatus
    stored_status: TaskStatus
    due_date: datetime | None
    estimated_duration_minutes: int | None
    is_overdue: bool


class NextBestTask(BaseModel):
    task: DashboardTaskSummary
    reasons: list[str]


class WeeklyActivityPoint(BaseModel):
    date: date
    day: str
    done: int = Field(ge=0)
    overdue: int = Field(ge=0)


class DashboardSummaryResponse(BaseModel):
    task_progress: ProgressSummary
    overdue_count: int = Field(ge=0)
    next_best_task: NextBestTask | None
    quick_wins: list[DashboardTaskSummary]
    in_progress: list[DashboardTaskSummary]
    weekly_activity: list[WeeklyActivityPoint]
