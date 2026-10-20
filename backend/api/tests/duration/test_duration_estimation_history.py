from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.auth.models import User
from app.focus.models import FocusSession
from app.tasks.duration_estimation.models import TaskDurationBaseline
from app.tasks.duration_estimation.repository import capture_baseline, load_duration_history
from app.tasks.models import Task, TaskStatus


def make_user(db):
    user = User(email=f"duration-{uuid4()}@example.com", password_hash="not-for-login")
    db.add(user)
    db.flush()
    return user


def make_history_task(db, user, *, minutes=(25, 50), status="completed", estimate=60):
    start = datetime.now(UTC) - timedelta(days=2)
    task = Task(
        user_id=user.id,
        title="Write course report",
        status=TaskStatus.DONE,
        estimated_duration_minutes=estimate,
        created_at=start,
        completed_at=start + timedelta(hours=20),
    )
    db.add(task)
    db.flush()
    for index, value in enumerate(minutes):
        session_start = start + timedelta(minutes=index * 300 + 1)
        db.add(
            FocusSession(
                user_id=user.id,
                task_id=task.id,
                started_at=session_start,
                ended_at=session_start + timedelta(minutes=max(value, 1)),
                duration_minutes=max(value, 1),
                planned_duration_minutes=25,
                actual_duration_seconds=value * 60,
                status=status,
                completed=status == "completed",
            )
        )
    db.flush()
    return task


def test_sql_aggregates_per_task_and_isolates_both_users(db_session):
    user, other = make_user(db_session), make_user(db_session)
    task = make_history_task(db_session, user)
    make_history_task(db_session, other)
    # Corrupt cross-owner linkage must never enter the aggregation.
    db_session.add(
        FocusSession(
            user_id=other.id,
            task_id=task.id,
            started_at=task.created_at + timedelta(hours=4),
            ended_at=task.created_at + timedelta(hours=5),
            duration_minutes=60,
            planned_duration_minutes=60,
            actual_duration_seconds=3600,
            status="completed",
            completed=True,
        )
    )
    db_session.flush()
    rows = load_duration_history(db_session, user_id=user.id, target_task_id=uuid4())
    assert len(rows) == 1
    assert rows[0].actual_minutes == 75
    assert rows[0].session_count == 2
    assert rows[0].completion_lead_minutes == 1200


@pytest.mark.parametrize("session_status", ["active", "paused", "cancelled"])
def test_abandoned_sessions_excluded(db_session, session_status):
    user = make_user(db_session)
    make_history_task(db_session, user, status=session_status)
    assert not load_duration_history(db_session, user_id=user.id, target_task_id=uuid4())


def test_partial_and_impossible_work_not_used_as_full_task_duration(db_session):
    user = make_user(db_session)
    task = make_history_task(db_session, user)
    db_session.add(
        FocusSession(
            user_id=user.id,
            task_id=task.id,
            started_at=task.created_at + timedelta(hours=12),
            ended_at=None,
            duration_minutes=25,
            planned_duration_minutes=25,
            actual_duration_seconds=600,
            status="active",
            completed=False,
        )
    )
    make_history_task(db_session, user, minutes=(0,))
    bad = make_history_task(db_session, user, minutes=(30,))
    from sqlalchemy import select

    session = db_session.scalar(select(FocusSession).where(FocusSession.task_id == bad.id))
    session.actual_duration_seconds = 100000
    db_session.flush()
    assert not load_duration_history(db_session, user_id=user.id, target_task_id=uuid4())


def test_baseline_is_frozen_and_owned(db_session):
    user, other = make_user(db_session), make_user(db_session)
    task = Task(user_id=user.id, title="Write report", estimated_duration_minutes=60)
    db_session.add(task)
    db_session.flush()
    with pytest.raises(LookupError):
        capture_baseline(db_session, user_id=other.id, task_id=task.id)
    capture_baseline(db_session, user_id=user.id, task_id=task.id)
    task.estimated_duration_minutes = 120
    db_session.flush()
    capture_baseline(db_session, user_id=user.id, task_id=task.id)
    assert db_session.get(TaskDurationBaseline, task.id).estimated_minutes == 60
