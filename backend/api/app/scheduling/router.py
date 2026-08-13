import uuid

from fastapi import APIRouter, HTTPException, status

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.scheduling import service
from app.scheduling.models import RecommendationStatus, ScheduleSuggestionStatus
from app.scheduling.schemas import (
    ApplyScheduleRequest,
    FocusSessionCreate,
    FocusSessionResponse,
    ScheduleAdjustRequest,
    ScheduleSuggestionResponse,
    SchedulingPlanResponse,
    AiRecommendationResponse,
)

router = APIRouter(prefix="/scheduling", tags=["scheduling"])


@router.get("/plan", response_model=SchedulingPlanResponse)
def get_plan(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> SchedulingPlanResponse:
    return service.generate_plan(db, current_user.id, force=False)


@router.post("/plan/regenerate", response_model=SchedulingPlanResponse)
def regenerate_plan(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> SchedulingPlanResponse:
    return service.generate_plan(db, current_user.id, force=True)


@router.post(
    "/focus-sessions",
    response_model=FocusSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_focus_session(
    payload: FocusSessionCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> FocusSessionResponse:
    try:
        return service.create_focus_session(db, current_user.id, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.post(
    "/recommendations/{recommendation_id}/accept",
    response_model=AiRecommendationResponse,
)
def accept_recommendation(
    recommendation_id: uuid.UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> AiRecommendationResponse:
    try:
        return service.set_recommendation_status(
            db,
            current_user.id,
            recommendation_id,
            RecommendationStatus.ACCEPTED,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/recommendations/{recommendation_id}/dismiss",
    response_model=AiRecommendationResponse,
)
def dismiss_recommendation(
    recommendation_id: uuid.UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> AiRecommendationResponse:
    try:
        return service.set_recommendation_status(
            db,
            current_user.id,
            recommendation_id,
            RecommendationStatus.DISMISSED,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/suggestions/{suggestion_id}/accept",
    response_model=ScheduleSuggestionResponse,
)
def accept_suggestion(
    suggestion_id: uuid.UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> ScheduleSuggestionResponse:
    try:
        return service.set_suggestion_status(
            db,
            current_user.id,
            suggestion_id,
            ScheduleSuggestionStatus.ACCEPTED,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/suggestions/{suggestion_id}/dismiss",
    response_model=ScheduleSuggestionResponse,
)
def dismiss_suggestion(
    suggestion_id: uuid.UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> ScheduleSuggestionResponse:
    try:
        return service.set_suggestion_status(
            db,
            current_user.id,
            suggestion_id,
            ScheduleSuggestionStatus.DISMISSED,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/suggestions/{suggestion_id}/adjust",
    response_model=ScheduleSuggestionResponse,
)
def adjust_suggestion(
    suggestion_id: uuid.UUID,
    payload: ScheduleAdjustRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> ScheduleSuggestionResponse:
    try:
        return service.adjust_suggestion(
            db,
            current_user.id,
            suggestion_id,
            payload,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.post("/suggestions/apply", response_model=SchedulingPlanResponse)
def apply_suggestions(
    payload: ApplyScheduleRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> SchedulingPlanResponse:
    return service.apply_suggestions(db, current_user.id, payload)
