from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.scheduling.schemas import SchedulingPlanResponse


class InsightTrendPoint(BaseModel):
    date: date
    completed_count: int = Field(ge=0)


class InsightRecommendation(BaseModel):
    id: str
    category: Literal["deep_focus", "consistency", "breaks", "schedule"]
    title: str
    description: str
    cta_label: str = "Learn more"


class InsightsSummaryResponse(BaseModel):
    user_first_name: str
    greeting: str
    weekly_summary_text: str
    tasks_completed_this_week: int = Field(ge=0)
    tasks_completed_last_week: int = Field(ge=0)
    week_over_week_change_percent: int | None = None
    estimated_work_minutes_this_week: int = Field(ge=0)
    estimated_work_time_label: str
    goal_progress_percent: int = Field(ge=0, le=100)
    current_streak_days: int = Field(ge=0)
    trend: list[InsightTrendPoint]
    recommendations: list[InsightRecommendation]
    scheduling_plan: SchedulingPlanResponse | None = None
    motivational_quote: str
    footer_message: str
    footnote: str = "AI based on your patterns"


class DailyProductivityPoint(BaseModel):
    date: date
    completed_count: int = Field(ge=0)
    focus_minutes: int = Field(ge=0)


class HourlyProductivityPoint(BaseModel):
    hour: int = Field(ge=0, le=23)
    completed_count: int = Field(ge=0)
    focus_minutes: int = Field(ge=0)


class WeeklyMetrics(BaseModel):
    period_start: datetime
    period_end: datetime
    completion_rate: float = Field(ge=0, le=1)
    completed_task_count: int = Field(ge=0)
    focus_duration_minutes: int = Field(ge=0)
    workload_minutes: int = Field(ge=0)
    current_streak_days: int = Field(ge=0)
    estimated_minutes: int = Field(ge=0)
    actual_minutes: int = Field(ge=0)
    estimate_accuracy_percent: float | None = Field(default=None, ge=0)
    productivity_trend: list[DailyProductivityPoint]
    productive_hours: list[HourlyProductivityPoint]


class WeeklyInsightNarrative(BaseModel):
    narrative: str = Field(min_length=1, max_length=1200)


class WeeklyInsightResponse(BaseModel):
    period_start: datetime
    period_end: datetime
    metrics: WeeklyMetrics
    narrative: str
    generated_at: datetime
    model: str
    prompt_version: str
    cached: bool
