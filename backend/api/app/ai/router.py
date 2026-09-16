from fastapi import APIRouter

from app.ai.schemas import AIUsageFeatureSummary
from app.ai.telemetry import summarize_ai_usage
from app.auth.dependencies import CurrentUser, DatabaseSession

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/usage-summary", response_model=list[AIUsageFeatureSummary])
def get_ai_usage_summary(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> list[AIUsageFeatureSummary]:
    """Return AI usage telemetry for the signed-in user, grouped by feature."""
    return summarize_ai_usage(db, current_user.id)
