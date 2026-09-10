import uuid

from fastapi import APIRouter, HTTPException, Query, status

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.focus import service
from app.focus.schemas import (
    FocusSessionCreate,
    FocusSessionDetail,
    FocusSessionFinish,
    FocusSessionProgress,
    FocusSessionResponse,
    FocusSessionStart,
)

router = APIRouter(prefix="/focus", tags=["focus"])


def _focus_error(exc: Exception) -> HTTPException:
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    return HTTPException(status_code=422, detail=str(exc))


@router.post(
    "/sessions",
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


@router.post("/sessions/start", response_model=FocusSessionDetail, status_code=201)
def start_focus_session(
    payload: FocusSessionStart,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> FocusSessionDetail:
    try:
        return service.start_focus_session(db, current_user.id, payload)
    except (LookupError, ValueError) as exc:
        raise _focus_error(exc) from exc


@router.patch("/sessions/{session_id}", response_model=FocusSessionDetail)
def update_focus_session(
    session_id: uuid.UUID,
    payload: FocusSessionProgress,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> FocusSessionDetail:
    try:
        return service.update_focus_session(db, current_user.id, session_id, payload)
    except (LookupError, ValueError) as exc:
        raise _focus_error(exc) from exc


@router.post("/sessions/{session_id}/complete", response_model=FocusSessionDetail)
def complete_focus_session(
    session_id: uuid.UUID,
    payload: FocusSessionFinish,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> FocusSessionDetail:
    try:
        return service.finish_focus_session(
            db, current_user.id, session_id, payload, completed=True
        )
    except (LookupError, ValueError) as exc:
        raise _focus_error(exc) from exc


@router.post("/sessions/{session_id}/cancel", response_model=FocusSessionDetail)
def cancel_focus_session(
    session_id: uuid.UUID,
    payload: FocusSessionFinish,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> FocusSessionDetail:
    try:
        return service.finish_focus_session(
            db, current_user.id, session_id, payload, completed=False
        )
    except (LookupError, ValueError) as exc:
        raise _focus_error(exc) from exc


@router.get("/sessions/active", response_model=FocusSessionDetail | None)
def get_active_focus_session(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> FocusSessionDetail | None:
    return service.get_active_focus_session(db, current_user.id)


@router.get("/sessions/history", response_model=list[FocusSessionDetail])
def list_focus_sessions(
    db: DatabaseSession,
    current_user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[FocusSessionDetail]:
    return service.list_focus_sessions(db, current_user.id, limit=limit)
