from fastapi import APIRouter, Header, HTTPException, status

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.dashboard import service
from app.dashboard.schemas import DashboardSummaryResponse
from app.timezones import validate_timezone_name

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
    client_timezone: str | None = Header(default=None, alias="X-Client-Timezone"),
) -> DashboardSummaryResponse:
    if client_timezone is not None:
        try:
            validate_timezone_name(client_timezone)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    return service.get_dashboard_summary(
        db,
        current_user.id,
        client_timezone_name=client_timezone,
    )
