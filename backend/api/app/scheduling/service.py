from __future__ import annotations

import uuid
from collections import Counter
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.ai import AIService, get_ai_service
from app.dashboard.schemas import DashboardTaskSummary
from app.focus.models import FocusSession
from app.scheduling.engine import RankedTask, build_schedule_slots, rank_open_tasks
from app.scheduling.gemini_prompt import build_ai_preview_prompt
from app.scheduling.models import (
    AiRecommendation,
    AiScheduleSuggestion,
    RecommendationStatus,
    ScheduleSuggestionStatus,
)
from app.scheduling.schemas import (
    AiPreviewRequest,
    AiPreviewResponse,
    AiPreviewSlotResponse,
    AiRecommendationResponse,
    AiWeightsSnapshot,
    ApplyScheduleRequest,
    GeminiSchedulePreview,
    ScheduleAdjustRequest,
    ScheduleSuggestionResponse,
    SchedulingPlanResponse,
)
from app.scheduling.validation import validate_ai_preview_schedule
from app.scoring.constraints import normalize_schedule_datetime, validate_schedule_candidate
from app.settings import service as settings_service
from app.settings.models import UserSettings
from app.tasks import service as task_service
from app.tasks.models import Task, TaskStatus
from app.tasks.overdue import is_task_overdue, utc_now
from app.tasks.schemas import TaskDisplayStatus, TaskUpdate


def _preview_settings(db: Session, user_id: uuid.UUID):
    settings = db.scalar(select(UserSettings).where(UserSettings.user_id == user_id))
    if settings is not None:
        return settings

    return SimpleNamespace(
        work_start=settings_service.DEFAULT_WORK_START,
        work_end=settings_service.DEFAULT_WORK_END,
        pomodoro_minutes=25,
        ai_assistant_enabled=True,
        ai_deadline_urgency_weight=80,
        ai_priority_weight=70,
        ai_estimated_duration_weight=50,
    )


def generate_ai_preview(
    db: Session,
    user_id: uuid.UUID,
    payload: AiPreviewRequest,
    *,
    ai_service: AIService | None = None,
) -> AiPreviewResponse:
    requested_tasks = task_service.get_tasks_by_ids(db, user_id, payload.task_ids)
    if len(requested_tasks) != len(payload.task_ids):
        raise LookupError("One or more tasks were not found")

    settings = _preview_settings(db, user_id)
    prompt = build_ai_preview_prompt(tasks=requested_tasks, settings=settings)
    result = (ai_service or get_ai_service()).generate_structured(
        user_key=str(user_id),
        prompt=prompt,
        response_schema=GeminiSchedulePreview,
        feature="schedule_preview",
        prompt_version="schedule-preview-v1",
    )
    preview = result.data

    existing_tasks = _open_tasks(db, user_id)
    validated_slots = validate_ai_preview_schedule(
        preview=preview,
        requested_tasks=requested_tasks,
        settings=settings,
        existing_tasks=existing_tasks,
    )
    task_by_id = {task.id: task for task in requested_tasks}

    return AiPreviewResponse(
        schedule=[
            AiPreviewSlotResponse(
                task_id=slot.task_id,
                task_title=task_by_id[slot.task_id].title,
                project_name=(
                    task_by_id[slot.task_id].project.name
                    if task_by_id[slot.task_id].project
                    else None
                ),
                suggested_start=slot.suggested_start,
                suggested_end=slot.suggested_end,
                explanation=slot.explanation,
                position=position,
            )
            for position, slot in enumerate(validated_slots)
        ],
        generated_at=utc_now(),
        model=result.metadata.model,
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
        pomodoro_minutes=settings.pomodoro_minutes,
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


def _preferred_focus_hours(db: Session, user_id: uuid.UUID) -> Counter[int]:
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
    return Counter(session.started_at.astimezone(UTC).hour for session in sessions)


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


def _validate_suggestion_candidate(
    *,
    task: Task,
    start: datetime,
    end: datetime,
    settings: UserSettings,
    existing_tasks: list[Task],
    existing_candidates: list[tuple[uuid.UUID, datetime, datetime]] | None = None,
) -> None:
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


def invalidate_pending_plan(
    db: Session,
    user_id: uuid.UUID,
    *,
    commit: bool = True,
) -> None:
    """Clear pending AI rows so the next plan read regenerates from fresh data."""

    for recommendation in db.scalars(
        select(AiRecommendation).where(
            AiRecommendation.user_id == user_id,
            AiRecommendation.status == RecommendationStatus.PENDING.value,
        )
    ).all():
        recommendation.status = RecommendationStatus.SUPERSEDED.value
        recommendation.updated_at = utc_now()

    for suggestion in db.scalars(
        select(AiScheduleSuggestion).where(
            AiScheduleSuggestion.user_id == user_id,
            AiScheduleSuggestion.status.in_(
                [
                    ScheduleSuggestionStatus.PENDING.value,
                    ScheduleSuggestionStatus.ADJUSTED.value,
                ]
            ),
        )
    ).all():
        suggestion.status = ScheduleSuggestionStatus.DISMISSED.value
        suggestion.updated_at = utc_now()

    if commit:
        db.commit()


def refresh_plan(db: Session, user_id: uuid.UUID) -> SchedulingPlanResponse:
    """Force a fresh recommendation/schedule from the latest user data."""

    return generate_plan(db, user_id, force=True)


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


def generate_plan(
    db: Session,
    user_id: uuid.UUID,
    *,
    force: bool = False,
) -> SchedulingPlanResponse:
    now = utc_now()
    settings = settings_service.get_or_create_user_settings(db, user_id)

    if not settings.ai_assistant_enabled:
        invalidate_pending_plan(db, user_id, commit=True)
        return SchedulingPlanResponse(
            recommendation=None,
            schedule=[],
            generated_at=now,
            footnote="AI assistant is disabled in Settings",
        )

    if not force:
        existing = get_current_plan(db, user_id)
        if (
            existing.recommendation is not None
            and not _plan_is_stale(db, user_id, existing, settings)
        ):
            return existing

    open_tasks = _open_tasks(db, user_id)
    ranked = rank_open_tasks(
        open_tasks,
        settings,
        now=now,
        preferred_focus_hours=_preferred_focus_hours(db, user_id),
        dismissed_task_ids=_recently_dismissed_task_ids(db, user_id),
    )

    invalidate_pending_plan(db, user_id, commit=False)

    top: RankedTask | None = ranked[0] if ranked else None
    recommendation: AiRecommendation | None = None

    if top is not None:
        recommendation = AiRecommendation(
            user_id=user_id,
            task_id=top.task.id,
            kind="next_task",
            title=f"Focus on “{top.task.title}” next",
            explanation=(
                "Picked from your open tasks using deadlines, priority, estimated "
                "duration, and recent focus patterns."
            ),
            reasons=top.reasons,
            based_on=top.based_on,
            score=top.score,
            status=RecommendationStatus.PENDING.value,
            weights_snapshot=_weights_snapshot(settings).model_dump(),
            generated_at=now,
        )
        db.add(recommendation)
        db.flush()

    slots = build_schedule_slots(
        ranked,
        settings,
        now=now,
        existing_tasks=open_tasks,
        existing_candidates=_active_suggestion_candidates(db, user_id),
    )
    created_suggestions: list[tuple[AiScheduleSuggestion, Task]] = []
    for position, (task, start, end, explanation) in enumerate(slots):
        suggestion = AiScheduleSuggestion(
            user_id=user_id,
            recommendation_id=recommendation.id if recommendation else None,
            task_id=task.id,
            suggested_start=start,
            suggested_end=end,
            explanation=explanation,
            status=ScheduleSuggestionStatus.PENDING.value,
            position=position,
            generated_at=now,
        )
        db.add(suggestion)
        created_suggestions.append((suggestion, task))

    db.commit()

    if recommendation is not None:
        db.refresh(recommendation)
    for suggestion, _task in created_suggestions:
        db.refresh(suggestion)

    task_by_id = {task.id: task for task in open_tasks}
    return SchedulingPlanResponse(
        recommendation=(
            _to_recommendation_response(
                recommendation,
                task_by_id.get(recommendation.task_id) if recommendation.task_id else None,
                now=now,
            )
            if recommendation is not None
            else None
        ),
        schedule=[
            _to_schedule_response(suggestion, task)
            for suggestion, task in created_suggestions
        ],
        generated_at=now,
    )


def get_current_plan(db: Session, user_id: uuid.UUID) -> SchedulingPlanResponse:
    now = utc_now()
    recommendation = db.scalar(
        select(AiRecommendation)
        .where(
            AiRecommendation.user_id == user_id,
            AiRecommendation.status == RecommendationStatus.PENDING.value,
        )
        .order_by(AiRecommendation.generated_at.desc())
    )

    suggestions = list(
        db.scalars(
            select(AiScheduleSuggestion)
            .where(
                AiScheduleSuggestion.user_id == user_id,
                AiScheduleSuggestion.status.in_(
                    [
                        ScheduleSuggestionStatus.PENDING.value,
                        ScheduleSuggestionStatus.ADJUSTED.value,
                    ]
                ),
            )
            .order_by(
                AiScheduleSuggestion.position.asc(),
                AiScheduleSuggestion.generated_at.desc(),
            )
        ).all()
    )

    task_ids = {
        *(
            [recommendation.task_id]
            if recommendation and recommendation.task_id
            else []
        ),
        *[item.task_id for item in suggestions],
    }
    tasks = {
        task.id: task
        for task in db.scalars(
            select(Task)
            .options(
                selectinload(Task.project),
                selectinload(Task.subtasks),
            )
            .where(Task.id.in_(task_ids))
        ).all()
    } if task_ids else {}

    return SchedulingPlanResponse(
        recommendation=(
            _to_recommendation_response(
                recommendation,
                tasks.get(recommendation.task_id) if recommendation.task_id else None,
                now=now,
            )
            if recommendation is not None
            else None
        ),
        schedule=[
            _to_schedule_response(item, tasks[item.task_id])
            for item in suggestions
            if item.task_id in tasks
        ],
        generated_at=recommendation.generated_at if recommendation else now,
    )


def get_dashboard_recommendation(
    db: Session,
    user_id: uuid.UUID,
) -> AiRecommendationResponse | None:
    plan = generate_plan(db, user_id, force=False)
    return plan.recommendation


def set_recommendation_status(
    db: Session,
    user_id: uuid.UUID,
    recommendation_id: uuid.UUID,
    status: RecommendationStatus,
) -> AiRecommendationResponse:
    recommendation = db.scalar(
        select(AiRecommendation).where(
            AiRecommendation.id == recommendation_id,
            AiRecommendation.user_id == user_id,
        )
    )
    if recommendation is None:
        raise LookupError("Recommendation not found")

    recommendation.status = status.value
    recommendation.updated_at = utc_now()
    db.commit()
    db.refresh(recommendation)

    # After dismiss/accept, immediately refresh so the next best option is ready.
    if status in {
        RecommendationStatus.DISMISSED,
        RecommendationStatus.ACCEPTED,
    }:
        refreshed = generate_plan(db, user_id, force=True)
        if refreshed.recommendation is not None:
            return refreshed.recommendation

    task = None
    if recommendation.task_id is not None:
        task = task_service.get_task_by_id(db, recommendation.task_id, user_id)

    return _to_recommendation_response(
        recommendation,
        task,
        now=utc_now(),
    )


def set_suggestion_status(
    db: Session,
    user_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    status: ScheduleSuggestionStatus,
) -> ScheduleSuggestionResponse:
    suggestion = db.scalar(
        select(AiScheduleSuggestion)
        .options()
        .where(
            AiScheduleSuggestion.id == suggestion_id,
            AiScheduleSuggestion.user_id == user_id,
        )
    )
    if suggestion is None:
        raise LookupError("Schedule suggestion not found")

    suggestion.status = status.value
    suggestion.updated_at = utc_now()
    db.commit()
    db.refresh(suggestion)

    task = task_service.get_task_by_id(db, suggestion.task_id, user_id)
    if task is None:
        raise LookupError("Task not found")
    return _to_schedule_response(suggestion, task)


def adjust_suggestion(
    db: Session,
    user_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    payload: ScheduleAdjustRequest,
) -> ScheduleSuggestionResponse:
    suggestion = db.scalar(
        select(AiScheduleSuggestion).where(
            AiScheduleSuggestion.id == suggestion_id,
            AiScheduleSuggestion.user_id == user_id,
        )
    )
    if suggestion is None:
        raise LookupError("Schedule suggestion not found")

    task = task_service.get_task_by_id(db, suggestion.task_id, user_id)
    if task is None:
        raise LookupError("Task not found")

    settings = settings_service.get_or_create_user_settings(db, user_id)
    _validate_suggestion_candidate(
        task=task,
        start=payload.suggested_start,
        end=payload.suggested_end,
        settings=settings,
        existing_tasks=_open_tasks(db, user_id),
        existing_candidates=_active_suggestion_candidates(
            db,
            user_id,
            exclude_suggestion_id=suggestion.id,
        ),
    )

    suggestion.suggested_start = normalize_schedule_datetime(payload.suggested_start)
    suggestion.suggested_end = normalize_schedule_datetime(payload.suggested_end)
    suggestion.status = ScheduleSuggestionStatus.ADJUSTED.value
    suggestion.updated_at = utc_now()
    db.commit()
    db.refresh(suggestion)

    return _to_schedule_response(suggestion, task)


def apply_suggestions(
    db: Session,
    user_id: uuid.UUID,
    payload: ApplyScheduleRequest,
) -> SchedulingPlanResponse:
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
    if payload.suggestion_ids:
        query = query.where(AiScheduleSuggestion.id.in_(payload.suggestion_ids))

    suggestions = list(db.scalars(query).all())
    settings = settings_service.get_or_create_user_settings(db, user_id)
    existing_tasks = _open_tasks(db, user_id)
    selected_candidates: list[tuple[uuid.UUID, datetime, datetime]] = []
    for suggestion in suggestions:
        task = task_service.get_task_by_id(db, suggestion.task_id, user_id)
        if task is None:
            continue
        _validate_suggestion_candidate(
            task=task,
            start=suggestion.suggested_start,
            end=suggestion.suggested_end,
            settings=settings,
            existing_tasks=existing_tasks,
            existing_candidates=selected_candidates,
        )
        selected_candidates.append(
            (
                suggestion.id,
                normalize_schedule_datetime(suggestion.suggested_start),
                normalize_schedule_datetime(suggestion.suggested_end),
            )
        )

    for suggestion in suggestions:
        task = task_service.get_task_by_id(db, suggestion.task_id, user_id)
        if task is None:
            continue
        task_service.update_task(
            db,
            task,
            TaskUpdate(
                scheduled_start=suggestion.suggested_start,
                scheduled_end=suggestion.suggested_end,
            ),
        )
        suggestion.status = ScheduleSuggestionStatus.APPLIED.value
        suggestion.updated_at = utc_now()

    recommendation = db.scalar(
        select(AiRecommendation).where(
            AiRecommendation.user_id == user_id,
            AiRecommendation.status == RecommendationStatus.PENDING.value,
        )
    )
    if recommendation is not None:
        recommendation.status = RecommendationStatus.APPLIED.value
        recommendation.updated_at = utc_now()

    db.commit()
    return get_current_plan(db, user_id)
