import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.tasks.models import TaskPriority, TaskStatus
from app.tasks.schemas import ProjectSummary, SubtaskProgress, TaskDisplayStatus


class ProgressSummary(BaseModel):
    completed: int = Field(ge=0)
    total: int = Field(ge=0)
    percent: int | None = None


class FocusGoalSummary(BaseModel):
    completed_minutes: int = Field(ge=0)
    goal_minutes: int = Field(gt=0)
    percent: int = Field(ge=0)


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
    subtask_progress: SubtaskProgress
    is_overdue: bool


class NextBestTask(BaseModel):
    task: DashboardTaskSummary
    reasons: list[str]


class AiRecommendationCard(BaseModel):
    id: uuid.UUID | None = None
    task: DashboardTaskSummary
    title: str
    explanation: str
    reasons: list[str]
    based_on: list[str]
    score: float = 0
    footnote: str = "AI based on your patterns"


class WeeklyActivityPoint(BaseModel):
    date: date
    day: str
    done: int = Field(ge=0)
    overdue: int = Field(ge=0)


class DashboardForestSummary(BaseModel):
    species_name: str | None = None
    display_name: str | None = None
    growth_stage: str | None = None
    growth_stage_label: str | None = None
    current_growth_points: int = 0
    next_stage_at: int | None = None
    total_trees_grown: int = 0
    unassigned_growth_points: int = 0
    needs_plant_selection: bool = False
    supportive_message: str = ""


class DashboardSummaryResponse(BaseModel):
    task_progress: ProgressSummary
    today_progress: ProgressSummary
    focus_goal: FocusGoalSummary
    current_streak_days: int = Field(ge=0)
    overdue_count: int = Field(ge=0)
    ai_recommendation: AiRecommendationCard | None
    next_best_task: NextBestTask | None = None
    quick_wins: list[DashboardTaskSummary]
    in_progress: list[DashboardTaskSummary]
    weekly_activity: list[WeeklyActivityPoint]
    forest: DashboardForestSummary | None = None
