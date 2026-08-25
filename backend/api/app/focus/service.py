from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.focus.models import FocusSession, FocusSessionStatus
from app.focus.schemas import (
    FocusSessionCreate,
    FocusSessionDetail,
    FocusSessionFinish,
    FocusSessionProgress,
    FocusSessionResponse,
    FocusSessionStart,
)
from app.tasks.models import Task


def _invalidate_ai_plan(db: Session, user_id: uuid.UUID) -> None:
    # Lazy import avoids making focus depend on scheduling at module import time.
    from app.scheduling import service as scheduling_service

    scheduling_service.invalidate_pending_plan(db, user_id)


def _focus_detail(
    session: FocusSession,
    *,
    growth_reward=None,
) -> FocusSessionDetail:
    return FocusSessionDetail(
        id=session.id,
        task_id=session.task_id,
        planned_duration_minutes=session.planned_duration_minutes,
        actual_duration_seconds=session.actual_duration_seconds,
        status=session.status,
        started_at=session.started_at,
        ended_at=session.ended_at,
        created_at=session.created_at,
        updated_at=session.updated_at,
        growth_reward=growth_reward,
    )


def _owned_focus_session(
    db: Session,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
) -> FocusSession:
    session = db.scalar(
        select(FocusSession).where(
            FocusSession.id == session_id,
            FocusSession.user_id == user_id,
        )
    )
    if session is None:
        raise LookupError("Focus session not found")
    return session


def start_focus_session(
    db: Session,
    user_id: uuid.UUID,
    payload: FocusSessionStart,
) -> FocusSessionDetail:
    if payload.task_id is not None:
        task = db.scalar(select(Task).where(Task.id == payload.task_id, Task.user_id == user_id))
        if task is None:
            raise LookupError("Task not found")

    existing = db.scalar(
        select(FocusSession).where(
            FocusSession.user_id == user_id,
            FocusSession.status.in_([
                FocusSessionStatus.ACTIVE.value,
                FocusSessionStatus.PAUSED.value,
            ]),
        )
    )
    if existing is not None:
        raise ValueError("An active focus session already exists")

    session = FocusSession(
        user_id=user_id,
        task_id=payload.task_id,
        started_at=datetime.now(UTC),
        ended_at=None,
        duration_minutes=payload.planned_duration_minutes,
        planned_duration_minutes=payload.planned_duration_minutes,
        actual_duration_seconds=0,
        status=FocusSessionStatus.ACTIVE.value,
        completed=False,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _focus_detail(session)


def update_focus_session(
    db: Session,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    payload: FocusSessionProgress,
) -> FocusSessionDetail:
    session = _owned_focus_session(db, user_id, session_id)
    if session.status not in (FocusSessionStatus.ACTIVE.value, FocusSessionStatus.PAUSED.value):
        raise ValueError("Finished focus sessions cannot be updated")
    if payload.status not in (FocusSessionStatus.ACTIVE, FocusSessionStatus.PAUSED):
        raise ValueError("Progress status must be active or paused")

    session.actual_duration_seconds = max(
        session.actual_duration_seconds,
        payload.actual_duration_seconds,
    )
    session.status = payload.status.value
    db.commit()
    db.refresh(session)
    return _focus_detail(session)


def finish_focus_session(
    db: Session,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    payload: FocusSessionFinish,
    *,
    completed: bool,
) -> FocusSessionDetail:
    session = _owned_focus_session(db, user_id, session_id)
    if session.status in (FocusSessionStatus.COMPLETED.value, FocusSessionStatus.CANCELLED.value):
        return _focus_detail(session)

    session.actual_duration_seconds = max(
        session.actual_duration_seconds,
        payload.actual_duration_seconds,
    )
    session.ended_at = datetime.now(UTC)
    session.status = (
        FocusSessionStatus.COMPLETED.value if completed else FocusSessionStatus.CANCELLED.value
    )
    session.completed = completed
    session.duration_minutes = max(1, (session.actual_duration_seconds + 59) // 60)
    db.commit()
    db.refresh(session)
    _invalidate_ai_plan(db, user_id)

    growth_reward = None
    if completed:
        try:
            from app.gamification import service as gamification_service

            reward = gamification_service.award_for_focus_session(db, user_id, session)
            if reward.awarded:
                growth_reward = reward
        except Exception:  # noqa: BLE001
            growth_reward = None
    return _focus_detail(session, growth_reward=growth_reward)


def get_active_focus_session(db: Session, user_id: uuid.UUID) -> FocusSessionDetail | None:
    session = db.scalar(
        select(FocusSession)
        .where(
            FocusSession.user_id == user_id,
            FocusSession.status.in_([
                FocusSessionStatus.ACTIVE.value,
                FocusSessionStatus.PAUSED.value,
            ]),
        )
        .order_by(FocusSession.started_at.desc())
    )
    return _focus_detail(session) if session else None


def list_focus_sessions(
    db: Session,
    user_id: uuid.UUID,
    *,
    limit: int = 50,
) -> list[FocusSessionDetail]:
    sessions = db.scalars(
        select(FocusSession)
        .where(FocusSession.user_id == user_id)
        .order_by(FocusSession.started_at.desc())
        .limit(limit)
    ).all()
    return [_focus_detail(session) for session in sessions]


def create_focus_session(
    db: Session,
    user_id: uuid.UUID,
    payload: FocusSessionCreate,
) -> FocusSessionResponse:
    if payload.ended_at <= payload.started_at:
        raise ValueError("ended_at must be later than started_at")

    session = FocusSession(
        user_id=user_id,
        task_id=payload.task_id,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        duration_minutes=payload.duration_minutes,
        planned_duration_minutes=payload.duration_minutes,
        actual_duration_seconds=payload.duration_minutes * 60,
        status=(
            FocusSessionStatus.COMPLETED.value
            if payload.completed
            else FocusSessionStatus.CANCELLED.value
        ),
        completed=payload.completed,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    _invalidate_ai_plan(db, user_id)

    growth_reward = None
    try:
        from app.gamification import service as gamification_service

        reward = gamification_service.award_for_focus_session(db, user_id, session)
        if reward.awarded:
            growth_reward = reward
    except Exception:  # noqa: BLE001
        growth_reward = None

    return FocusSessionResponse(
        id=session.id,
        task_id=session.task_id,
        started_at=session.started_at,
        ended_at=session.ended_at,
        duration_minutes=session.duration_minutes,
        completed=session.completed,
        growth_reward=growth_reward,
    )
