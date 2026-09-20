from fastapi import APIRouter, Header, HTTPException, status

from app.analytics import service
from app.analytics.schemas import InsightsSummaryResponse, WeeklyInsightResponse
from app.auth.dependencies import CurrentUser, DatabaseSession
from app.timezones import validate_timezone_name

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/insights", response_model=InsightsSummaryResponse)
def get_insights_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
    client_timezone: str | None = Header(default=None, alias="X-Client-Timezone"),
) -> InsightsSummaryResponse:
    """Return personalized productivity insights for the current user."""
    if client_timezone is not None:
        try:
            validate_timezone_name(client_timezone)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    return service.get_insights_summary(
        db,
        current_user,
        client_timezone_name=client_timezone,
    )


@router.get("/weekly-insight", response_model=WeeklyInsightResponse)
def get_weekly_insight(
    db: DatabaseSession,
    current_user: CurrentUser,
    client_timezone: str | None = Header(default=None, alias="X-Client-Timezone"),
) -> WeeklyInsightResponse:
    """Return the cached weekly AI insight, creating it once per user/week."""
    if client_timezone is not None:
        try:
            validate_timezone_name(client_timezone)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    return service.get_or_create_weekly_insight(
        db,
        current_user,
        client_timezone_name=client_timezone,
    )
