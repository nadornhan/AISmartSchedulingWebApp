from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .models import UserScheduleState


def lock_schedule_revision(db: Session, user_id: uuid.UUID) -> int:
    """Create lazily and lock the user's revision row for this transaction."""

    db.execute(
        insert(UserScheduleState)
        .values(user_id=user_id, revision=0)
        .on_conflict_do_nothing(index_elements=[UserScheduleState.user_id])
    )
    state = db.scalar(
        select(UserScheduleState).where(UserScheduleState.user_id == user_id).with_for_update()
    )
    if state is None:
        raise RuntimeError("Unable to initialize schedule revision")
    return state.revision


def bump_schedule_revision(db: Session, user_id: uuid.UUID) -> int:
    """Atomically increment without committing; the caller owns the transaction."""

    revision = db.scalar(
        insert(UserScheduleState)
        .values(user_id=user_id, revision=1)
        .on_conflict_do_update(
            index_elements=[UserScheduleState.user_id],
            set_={
                "revision": UserScheduleState.revision + 1,
                "updated_at": func.now(),
            },
        )
        .returning(UserScheduleState.revision)
    )
    if revision is None:
        raise RuntimeError("Unable to update schedule revision")
    return revision
