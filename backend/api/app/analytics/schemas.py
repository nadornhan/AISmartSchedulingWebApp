from datetime import date
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
