from fastapi import APIRouter

from app.analytics import service
from app.analytics.schemas import InsightsSummaryResponse, WeeklyInsightResponse
from app.auth.dependencies import CurrentUser, DatabaseSession

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/insights", response_model=InsightsSummaryResponse)
def get_insights_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> InsightsSummaryResponse:
    """Return personalized productivity insights for the current user."""
    return service.get_insights_summary(db, current_user)


@router.get("/weekly-insight", response_model=WeeklyInsightResponse)
def get_weekly_insight(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> WeeklyInsightResponse:
    """Return the cached weekly AI insight, creating it once per user/week."""
    return service.get_or_create_weekly_insight(db, current_user)
