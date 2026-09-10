from fastapi import APIRouter

from app.analytics.schemas import InsightsSummaryResponse
from app.analytics import service
from app.auth.dependencies import CurrentUser, DatabaseSession

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/insights", response_model=InsightsSummaryResponse)
def get_insights_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> InsightsSummaryResponse:
    """Return personalized productivity insights for the current user."""
    return service.get_insights_summary(db, current_user)
