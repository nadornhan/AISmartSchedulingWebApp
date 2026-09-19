from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.ai import AIService, get_ai_service
from app.auth.dependencies import CurrentUser, DatabaseSession
from app.tasks.duration_estimation import service
from app.tasks.duration_estimation.proposal import DurationConflict
from app.tasks.duration_estimation.schemas import (
    DurationConfirmRequest,
    DurationConfirmResponse,
    DurationPreviewResponse,
)

router = APIRouter(prefix="/{task_id}/duration", tags=["task-duration"])
AIServiceDependency = Annotated[AIService, Depends(get_ai_service)]


def _error(exc):
    code = (
        404 if isinstance(exc, LookupError) else 409 if isinstance(exc, DurationConflict) else 422
    )
    return HTTPException(status_code=code, detail=str(exc))


@router.post("/preview", response_model=DurationPreviewResponse)
def preview_duration(
    task_id: UUID, db: DatabaseSession, current_user: CurrentUser, ai_service: AIServiceDependency
):
    try:
        return service.preview_duration_estimate(
            db, user_id=current_user.id, task_id=task_id, ai_service=ai_service
        )
    except (LookupError, ValueError) as exc:
        raise _error(exc) from exc


@router.post("/confirm", response_model=DurationConfirmResponse)
def confirm_duration(
    task_id: UUID, payload: DurationConfirmRequest, db: DatabaseSession, current_user: CurrentUser
):
    try:
        return service.confirm_duration_estimate(
            db, user_id=current_user.id, task_id=task_id, payload=payload
        )
    except (LookupError, ValueError) as exc:
        db.rollback()
        raise _error(exc) from exc
