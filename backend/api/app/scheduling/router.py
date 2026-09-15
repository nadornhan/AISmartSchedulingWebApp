import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.ai import AIService, get_ai_service
from app.auth.dependencies import CurrentUser, DatabaseSession
from app.scheduling import lifecycle, service
from app.scheduling.lifecycle import RescheduleLifecycleConflict
from app.scheduling.models import RecommendationStatus, ScheduleSuggestionStatus
from app.scheduling.schemas import (
    AiPreviewRequest,
    AiPreviewResponse,
    AiRecommendationResponse,
    ApplyScheduleRequest,
    RescheduleApplyRequest,
    RescheduleConflictResponse,
    RescheduleErrorDetail,
    ReschedulePreviewRequest,
    RescheduleProposalResponse,
    ScheduleAdjustRequest,
    ScheduleSuggestionResponse,
    SchedulingPlanResponse,
)
from app.scheduling.validation import DeterministicScheduleValidationError

router = APIRouter(prefix="/scheduling", tags=["scheduling"])
AIServiceDependency = Annotated[AIService, Depends(get_ai_service)]


def _reschedule_conflict(exc: RescheduleLifecycleConflict) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=RescheduleErrorDetail(
            code=exc.code,
            message=str(exc),
        ).model_dump(mode="json"),
    )


@router.post(
    "/reschedule/preview",
    response_model=RescheduleProposalResponse,
    responses={status.HTTP_409_CONFLICT: {"model": RescheduleConflictResponse}},
)
def preview_reschedule(
    payload: ReschedulePreviewRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> RescheduleProposalResponse:
    # AI explanations are enriched separately; deterministic options are always authoritative.
    del payload
    try:
        result = lifecycle.create_reschedule_preview(db, current_user.id)
        return lifecycle.serialize_reschedule_proposal(result.proposal)
    except RescheduleLifecycleConflict as exc:
        raise _reschedule_conflict(exc) from exc


@router.post(
    "/reschedule/{proposal_id}/apply",
    response_model=RescheduleProposalResponse,
    responses={
        status.HTTP_404_NOT_FOUND: {"description": "Proposal not found"},
        status.HTTP_409_CONFLICT: {"model": RescheduleConflictResponse},
    },
)
def apply_reschedule(
    proposal_id: uuid.UUID,
    payload: RescheduleApplyRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> RescheduleProposalResponse:
    try:
        result = lifecycle.apply_reschedule_proposal(
            db,
            current_user.id,
            proposal_id,
            payload.option_id,
        )
        return lifecycle.serialize_reschedule_proposal(
            result.proposal,
            idempotent=result.idempotent,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reschedule proposal not found",
        ) from exc
    except RescheduleLifecycleConflict as exc:
        raise _reschedule_conflict(exc) from exc


@router.post(
    "/reschedule/{proposal_id}/undo",
    response_model=RescheduleProposalResponse,
    responses={
        status.HTTP_404_NOT_FOUND: {"description": "Proposal not found"},
        status.HTTP_409_CONFLICT: {"model": RescheduleConflictResponse},
    },
)
def undo_reschedule(
    proposal_id: uuid.UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> RescheduleProposalResponse:
    try:
        result = lifecycle.undo_reschedule_proposal(db, current_user.id, proposal_id)
        return lifecycle.serialize_reschedule_proposal(
            result.proposal,
            idempotent=result.idempotent,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reschedule proposal not found",
        ) from exc
    except RescheduleLifecycleConflict as exc:
        raise _reschedule_conflict(exc) from exc


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


@router.post("/ai-preview", response_model=AiPreviewResponse)
def generate_ai_preview(
    payload: AiPreviewRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
    ai_service: AIServiceDependency,
) -> AiPreviewResponse:
    try:
        return service.generate_ai_preview(
            db,
            current_user.id,
            payload,
            ai_service=ai_service,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DeterministicScheduleValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI could not produce a valid schedule preview",
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
    try:
        return service.apply_suggestions(db, current_user.id, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
