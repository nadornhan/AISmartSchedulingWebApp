from __future__ import annotations

import uuid
from collections import Counter
from datetime import datetime, timedelta
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.dashboard.schemas import DashboardTaskSummary
from app.focus.models import FocusSession
from app.scheduling.models import (
    AiRecommendation,
    AiScheduleSuggestion,
    RecommendationStatus,
    ScheduleSuggestionStatus,
)
from app.scheduling.schemas import (
    AiRecommendationResponse,
    AiWeightsSnapshot,
    ScheduleSuggestionResponse,
    SchedulingIssueResponse,
    SchedulingPlanResponse,
)
from app.scheduling.windows import scheduling_required_minutes
from app.scoring.constraints import normalize_schedule_datetime, validate_schedule_candidate
from app.settings import service as settings_service
from app.settings.models import (
    DEFAULT_DAILY_WORK_LIMIT_MINUTES,
    UserSettings,
    effective_daily_work_limit_minutes,
)
from app.tasks import service as task_service
from app.tasks.models import Task, TaskStatus
from app.tasks.overdue import is_task_overdue, utc_now
from app.tasks.schemas import TaskDisplayStatus
from app.timezones import local_hour


def _preview_settings(db: Session, user_id: uuid.UUID):
    settings = db.scalar(select(UserSettings).where(UserSettings.user_id == user_id))
    if settings is not None:
        return settings

    return SimpleNamespace(
        work_start=settings_service.DEFAULT_WORK_START,
        work_end=settings_service.DEFAULT_WORK_END,
        timezone=settings_service.DEFAULT_TIMEZONE,
        pomodoro_minutes=25,
        daily_work_limit_minutes=DEFAULT_DAILY_WORK_LIMIT_MINUTES,
        ai_assistant_enabled=True,
        ai_deadline_urgency_weight=80,
        ai_priority_weight=70,
        ai_estimated_duration_weight=50,
    )


def _task_summary(task: Task, *, now: datetime) -> DashboardTaskSummary:
    overdue = is_task_overdue(
        status=task.status,
        due_date=task.due_date,
        now=now,
    )
    return DashboardTaskSummary(
        id=task.id,
        title=task.title,
        description=task.description,
        project_id=task.project_id,
        project=task.project,
        priority=task.priority,
        status=(
            TaskDisplayStatus.OVERDUE
            if overdue
            else TaskDisplayStatus(task.status.value)
        ),
        stored_status=task.status,
        due_date=task.due_date,
        estimated_duration_minutes=task.estimated_duration_minutes,
        subtask_progress=task.subtask_progress,
        is_overdue=overdue,
    )


def _weights_snapshot(settings) -> AiWeightsSnapshot:
    return AiWeightsSnapshot(
        deadline_urgency=settings.ai_deadline_urgency_weight,
        priority=settings.ai_priority_weight,
        estimated_duration=settings.ai_estimated_duration_weight,
        ai_assistant_enabled=settings.ai_assistant_enabled,
        work_start=settings.work_start.strftime("%H:%M"),
        work_end=settings.work_end.strftime("%H:%M"),
        timezone=settings.timezone,
        pomodoro_minutes=settings.pomodoro_minutes,
        daily_work_limit_minutes=effective_daily_work_limit_minutes(settings),
    )


def _open_tasks(db: Session, user_id: uuid.UUID) -> list[Task]:
    return list(
        db.scalars(
            select(Task)
            .options(
                selectinload(Task.project),
                selectinload(Task.subtasks),
            )
            .where(
                Task.user_id == user_id,
                Task.status != TaskStatus.DONE,
            )
        ).all()
    )


def _preferred_focus_hours(
    db: Session,
    user_id: uuid.UUID,
    *,
    timezone_name: str,
) -> Counter[int]:
    sessions = list(
        db.scalars(
            select(FocusSession).where(
                FocusSession.user_id == user_id,
                FocusSession.completed.is_(True),
                FocusSession.started_at
                >= utc_now() - timedelta(days=30),
            )
        ).all()
    )
    return Counter(
        local_hour(session.started_at, timezone_name)
        for session in sessions
    )


def _recently_dismissed_task_ids(db: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    cutoff = utc_now() - timedelta(hours=12)
    rows = db.scalars(
        select(AiRecommendation.task_id).where(
            AiRecommendation.user_id == user_id,
            AiRecommendation.status == RecommendationStatus.DISMISSED.value,
            AiRecommendation.updated_at >= cutoff,
            AiRecommendation.task_id.is_not(None),
        )
    ).all()
    return {task_id for task_id in rows if task_id is not None}


def _active_suggestion_candidates(
    db: Session,
    user_id: uuid.UUID,
    *,
    exclude_suggestion_id: uuid.UUID | None = None,
) -> list[tuple[uuid.UUID, datetime, datetime]]:
    query = select(AiScheduleSuggestion).where(
        AiScheduleSuggestion.user_id == user_id,
        AiScheduleSuggestion.status.in_(
            [
                ScheduleSuggestionStatus.PENDING.value,
                ScheduleSuggestionStatus.ADJUSTED.value,
                ScheduleSuggestionStatus.ACCEPTED.value,
            ]
        ),
    )
    if exclude_suggestion_id is not None:
        query = query.where(AiScheduleSuggestion.id != exclude_suggestion_id)

    return [
        (
            suggestion.id,
            normalize_schedule_datetime(suggestion.suggested_start),
            normalize_schedule_datetime(suggestion.suggested_end),
        )
        for suggestion in db.scalars(query).all()
    ]


def _accepted_suggestions(
    db: Session,
    user_id: uuid.UUID,
) -> list[AiScheduleSuggestion]:
    return list(
        db.scalars(
            select(AiScheduleSuggestion).where(
                AiScheduleSuggestion.user_id == user_id,
                AiScheduleSuggestion.status == ScheduleSuggestionStatus.ACCEPTED.value,
            )
        ).all()
    )


def _validate_suggestion_candidate(
    *,
    task: Task,
    start: datetime,
    end: datetime,
    settings: UserSettings,
    existing_tasks: list[Task],
    existing_candidates: list[tuple[uuid.UUID, datetime, datetime]] | None = None,
) -> None:
    duration_minutes = int(
        (
            normalize_schedule_datetime(end) - normalize_schedule_datetime(start)
        ).total_seconds()
        // 60
    )
    required_minutes = scheduling_required_minutes(task, settings)
    if duration_minutes != required_minutes:
        raise ValueError("Schedule duration does not match task duration")

    validation = validate_schedule_candidate(
        task=task,
        start=start,
        end=end,
        settings=settings,
        existing_tasks=existing_tasks,
        existing_candidates=existing_candidates,
        require_unscheduled_task=True,
    )
    if not validation.valid:
        failed = next(check for check in validation.checks if not check.passed)
        raise ValueError(failed.reason or "Invalid schedule")


def _to_recommendation_response(
    recommendation: AiRecommendation,
    task: Task | None,
    *,
    now: datetime,
) -> AiRecommendationResponse:
    weights = AiWeightsSnapshot.model_validate(recommendation.weights_snapshot)
    return AiRecommendationResponse(
        id=recommendation.id,
        task=_task_summary(task, now=now) if task is not None else None,
        title=recommendation.title,
        explanation=recommendation.explanation,
        reasons=list(recommendation.reasons or []),
        based_on=list(recommendation.based_on or []),
        score=recommendation.score,
        status=recommendation.status,
        weights=weights,
        generated_at=recommendation.generated_at,
    )


def _to_schedule_response(
    suggestion: AiScheduleSuggestion,
    task: Task,
) -> ScheduleSuggestionResponse:
    return ScheduleSuggestionResponse(
        id=suggestion.id,
        task_id=task.id,
        task_title=task.title,
        project_name=task.project.name if task.project else None,
        suggested_start=suggestion.suggested_start,
        suggested_end=suggestion.suggested_end,
        explanation=suggestion.explanation,
        status=suggestion.status,
        position=suggestion.position,
    )


def _to_issue_response(issue) -> SchedulingIssueResponse:
    return SchedulingIssueResponse(
        task_id=issue.task_id,
        task_title=issue.task_title,
        code=issue.code,
        severity=issue.severity,
        reason=issue.reason,
        metadata=issue.metadata,
    )


def _schedule_response_sort_key(response: ScheduleSuggestionResponse) -> tuple:
    return (
        normalize_schedule_datetime(response.suggested_start),
        normalize_schedule_datetime(response.suggested_end),
        response.position,
        str(response.id),
    )


def _chronological_schedule(
    responses: list[ScheduleSuggestionResponse],
) -> list[ScheduleSuggestionResponse]:
    return sorted(responses, key=_schedule_response_sort_key)


def _plan_is_stale(
    db: Session,
    user_id: uuid.UUID,
    plan: SchedulingPlanResponse,
    settings,
) -> bool:
    if plan.recommendation is None:
        return True

    snapshot = plan.recommendation.weights
    if (
        snapshot.deadline_urgency != settings.ai_deadline_urgency_weight
        or snapshot.priority != settings.ai_priority_weight
        or snapshot.estimated_duration != settings.ai_estimated_duration_weight
        or snapshot.ai_assistant_enabled != settings.ai_assistant_enabled
        or snapshot.work_start != settings.work_start.strftime("%H:%M")
        or snapshot.work_end != settings.work_end.strftime("%H:%M")
        or snapshot.timezone != settings.timezone
        or snapshot.pomodoro_minutes != settings.pomodoro_minutes
    ):
        return True

    if plan.recommendation.task is None:
        return True

    task = task_service.get_task_by_id(db, plan.recommendation.task.id, user_id)
    if task is None or task.status == TaskStatus.DONE:
        return True

    newer_task = db.scalar(
        select(Task.id).where(
            Task.user_id == user_id,
            Task.updated_at > plan.generated_at,
        ).limit(1)
    )
    return newer_task is not None
