from fastapi import APIRouter

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.dashboard import service
from app.dashboard.schemas import DashboardSummaryResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> DashboardSummaryResponse:
    return service.get_dashboard_summary(db, current_user.id)
