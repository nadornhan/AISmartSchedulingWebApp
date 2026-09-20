from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.ai import AIService, get_ai_service
from app.auth.dependencies import CurrentUser, DatabaseSession
from app.tasks import generation_service
from app.tasks.generation_schemas import (
    TaskGenerationConfirmRequest,
    TaskGenerationConfirmResponse,
    TaskGenerationPreviewResponse,
    TaskGenerationRequest,
)

router = APIRouter(prefix="/generate", tags=["task-generation"])
AIServiceDependency = Annotated[AIService, Depends(get_ai_service)]


@router.post("/preview", response_model=TaskGenerationPreviewResponse)
def preview_tasks(
    payload: TaskGenerationRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
    ai_service: AIServiceDependency,
):
    try:
        return generation_service.preview(
            db,
            user_id=current_user.id,
            prompt=payload.prompt,
            ai_service=ai_service,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/confirm", response_model=TaskGenerationConfirmResponse)
def confirm_tasks(
    payload: TaskGenerationConfirmRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    try:
        return generation_service.confirm(
            db,
            user_id=current_user.id,
            payload=payload,
        )
    except LookupError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
