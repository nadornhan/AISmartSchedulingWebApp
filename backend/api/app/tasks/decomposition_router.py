from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.ai import AIService, get_ai_service
from app.auth.dependencies import CurrentUser, DatabaseSession
from app.tasks import decomposition_service
from app.tasks.decomposition_schemas import (
    TaskDecompositionConfirmRequest,
    TaskDecompositionConfirmResponse,
    TaskDecompositionPreviewResponse,
    TaskDecompositionRequest,
)

router = APIRouter(prefix="/decompose", tags=["task-decomposition"])
AIServiceDependency = Annotated[AIService, Depends(get_ai_service)]


@router.post("/preview", response_model=TaskDecompositionPreviewResponse)
def preview_decomposition(
    payload: TaskDecompositionRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
    ai_service: AIServiceDependency,
):
    return decomposition_service.preview(
        db,
        user_id=current_user.id,
        prompt=payload.prompt,
        ai_service=ai_service,
    )


@router.post("/confirm", response_model=TaskDecompositionConfirmResponse)
def confirm_decomposition(
    payload: TaskDecompositionConfirmRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    try:
        return decomposition_service.confirm(
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
