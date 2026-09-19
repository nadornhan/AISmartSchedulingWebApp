from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, case, exists, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, aliased, selectinload

from app.focus.models import FocusSession
from app.settings.models import UserSettings
from app.tasks.duration_estimation.models import DurationEstimateDecision, TaskDurationBaseline
from app.tasks.duration_estimation.proposal import task_snapshot
from app.tasks.duration_estimation.schemas import DurationHistorySample
from app.tasks.models import Task, TaskStatus

HISTORY_DAYS = 180
HISTORY_LIMIT = 200


def get_owned_task(db: Session, *, user_id, task_id, lock=False):
    statement = (
        select(Task)
        .where(Task.id == task_id, Task.user_id == user_id)
        .options(selectinload(Task.subtasks), selectinload(Task.project))
    )
    if lock:
        statement = statement.with_for_update().execution_options(populate_existing=True)
    task = db.scalar(statement)
    if task is None:
        raise LookupError("Task not found")
    return task


def get_user_settings(db, *, user_id):
    # Unlike get_or_create_user_settings, this never writes during preview.
    return db.scalar(select(UserSettings).where(UserSettings.user_id == user_id))


def load_duration_history(db, *, user_id, target_task_id, now=None):
    now = now or datetime.now(UTC)
    abandoned = aliased(FocusSession)
    has_partial_work = exists(
        select(abandoned.id).where(
            abandoned.task_id == Task.id,
            abandoned.user_id == user_id,
            abandoned.actual_duration_seconds > 0,
            ~func.coalesce(_valid_session(abandoned), False),
        )
    )
    actual_seconds = func.sum(FocusSession.actual_duration_seconds)
    baseline_minutes = case(
        (TaskDurationBaseline.task_id.is_not(None), TaskDurationBaseline.estimated_minutes),
        else_=Task.estimated_duration_minutes,
    )
    statement = (
        select(
            Task.id.label("task_id"),
            Task.title,
            Task.description,
            Task.project_id,
            baseline_minutes.label("estimated_minutes"),
            func.coalesce(TaskDurationBaseline.reference_source, "legacy_current").label(
                "reference_source"
            ),
            (actual_seconds / 60.0).label("actual_minutes"),
            func.count(FocusSession.id).label("session_count"),
            Task.completed_at,
            (func.extract("epoch", Task.completed_at - Task.created_at) / 60.0).label(
                "completion_lead_minutes"
            ),
        )
        .join(FocusSession, and_(FocusSession.task_id == Task.id, FocusSession.user_id == user_id))
        .outerjoin(
            TaskDurationBaseline,
            and_(TaskDurationBaseline.task_id == Task.id, TaskDurationBaseline.user_id == user_id),
        )
        .where(
            Task.user_id == user_id,
            Task.id != target_task_id,
            Task.status == TaskStatus.DONE,
            Task.completed_at.is_not(None),
            Task.completed_at >= now - timedelta(days=HISTORY_DAYS),
            Task.completed_at <= now,
            Task.completed_at > Task.created_at,
            _valid_session(FocusSession),
            ~has_partial_work,
        )
        .group_by(Task.id, TaskDurationBaseline.task_id)
        .having(actual_seconds <= func.extract("epoch", Task.completed_at - Task.created_at) + 60)
        .order_by(Task.completed_at.desc(), Task.id)
        .limit(HISTORY_LIMIT)
    )
    return [
        DurationHistorySample.model_validate(dict(row)) for row in db.execute(statement).mappings()
    ]


def _valid_session(session):
    return and_(
        session.status == "completed",
        session.completed.is_(True),
        session.actual_duration_seconds > 0,
        session.ended_at.is_not(None),
        session.ended_at > session.started_at,
        session.started_at >= Task.created_at,
        session.ended_at <= Task.completed_at,
        session.actual_duration_seconds
        <= func.extract("epoch", session.ended_at - session.started_at) + 60,
    )


def get_decision(db, *, user_id, task_id, proposal_id):
    return db.scalar(
        select(DurationEstimateDecision).where(
            DurationEstimateDecision.proposal_id == proposal_id,
            DurationEstimateDecision.user_id == user_id,
            DurationEstimateDecision.task_id == task_id,
        )
    )


def capture_baseline(db, *, user_id, task_id):
    """Called by focus writes; participates in their transaction, never commits."""
    task = get_owned_task(db, user_id=user_id, task_id=task_id, lock=True)
    # Do not pretend a post-deployment snapshot predates existing sessions.
    if db.scalar(
        select(FocusSession.id)
        .where(FocusSession.task_id == task_id, FocusSession.user_id == user_id)
        .limit(1)
    ):
        return
    minutes, source = task.estimated_duration_minutes, "user_snapshot"
    decision = db.scalar(
        select(DurationEstimateDecision)
        .where(
            DurationEstimateDecision.task_id == task_id,
            DurationEstimateDecision.user_id == user_id,
            DurationEstimateDecision.action.in_(["accepted", "changed"]),
        )
        .order_by(DurationEstimateDecision.resolved_at.desc())
        .limit(1)
    )
    if (
        decision
        and decision.task_snapshot_after == task_snapshot(task)
        and decision.estimate["source"] == "ai_prior"
    ):
        minutes, source = decision.estimate["prior_minutes"], "ai_prior_snapshot"
    db.execute(
        insert(TaskDurationBaseline)
        .values(
            task_id=task_id,
            user_id=user_id,
            estimated_minutes=minutes,
            reference_source=source,
        )
        .on_conflict_do_nothing(index_elements=["task_id"])
    )
