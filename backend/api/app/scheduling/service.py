from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.ai import AIFeature, AIService, get_ai_service
from app.focus.models import FocusSession, FocusSessionStatus
from app.scheduling.detection import (
    ReschedulingDetectionResult,
    detect_rescheduling_needs,
)
from app.scheduling.engine import (
    RankedTask,
    build_schedule_result,
    free_windows_for_current_state,
    planning_horizon_for_scheduling,
    rank_open_tasks,
    scheduling_issues_for_final_state,
)
from app.scheduling.gemini_prompt import build_ai_preview_prompt
from app.scheduling.models import (
    AiRecommendation,
    AiScheduleSuggestion,
    RecommendationStatus,
    ScheduleSuggestionStatus,
)

# Re-export existing service helpers for callers and regression coverage.
from app.scheduling.plan_helpers import (  # noqa: F401
    _accepted_suggestions,
    _active_suggestion_candidates,
    _chronological_schedule,
    _open_tasks,
    _plan_is_stale,
    _preferred_focus_hours,
    _preview_settings,
    _recently_dismissed_task_ids,
    _schedule_response_sort_key,
    _task_summary,
    _to_issue_response,
    _to_recommendation_response,
    _to_schedule_response,
    _validate_suggestion_candidate,
    _weights_snapshot,
)
from app.scheduling.schemas import (
    AiPreviewRequest,
    AiPreviewResponse,
    AiPreviewSlotResponse,
    AiRecommendationResponse,
    ApplyScheduleRequest,
    GeminiSchedulePreview,
    ScheduleAdjustRequest,
    ScheduleSuggestionResponse,
    SchedulingPlanResponse,
)
from app.scheduling.validation import validate_ai_preview_schedule
from app.scoring.constraints import normalize_schedule_datetime
from app.settings import service as settings_service
from app.tasks import service as task_service
from app.tasks.models import Task
from app.tasks.overdue import utc_now
from app.tasks.schemas import TaskUpdate


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
        feature=AIFeature.SCHEDULE_PREVIEW,
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


def detect_current_rescheduling_needs(
    db: Session,
    user_id: uuid.UUID,
    *,
    now: datetime | None = None,
) -> ReschedulingDetectionResult:
    """Load user-scoped current state and run the pure rescheduling audit."""

    active_focus_sessions = list(
        db.scalars(
            select(FocusSession).where(
                FocusSession.user_id == user_id,
                FocusSession.status.in_(
                    [
                        FocusSessionStatus.ACTIVE.value,
                        FocusSessionStatus.PAUSED.value,
                    ]
                ),
            )
        ).all()
    )
    return detect_rescheduling_needs(
        tasks=_open_tasks(db, user_id),
        settings=_preview_settings(db, user_id),
        now=now or utc_now(),
        focus_sessions=active_focus_sessions,
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

    # Pending and adjusted rows belong to the plan being replaced. Remove them
    # before calculating capacity so regeneration cannot conflict with its own
    # obsolete suggestions.
    invalidate_pending_plan(db, user_id, commit=False)
    db.flush()

    open_tasks = _open_tasks(db, user_id)
    retained_suggestions = _accepted_suggestions(db, user_id)
    retained_task_ids = {suggestion.task_id for suggestion in retained_suggestions}
    schedulable_tasks = [task for task in open_tasks if task.id not in retained_task_ids]
    preferred_focus_hours = _preferred_focus_hours(
        db,
        user_id,
        timezone_name=settings.timezone,
    )
    active_suggestion_candidates = _active_suggestion_candidates(db, user_id)
    capacity_windows = free_windows_for_current_state(
        settings=settings,
        now=now,
        existing_tasks=open_tasks,
        existing_candidates=active_suggestion_candidates,
    )
    ranked = rank_open_tasks(
        schedulable_tasks,
        settings,
        now=now,
        preferred_focus_hours=preferred_focus_hours,
        dismissed_task_ids=_recently_dismissed_task_ids(db, user_id),
        capacity_windows=capacity_windows,
    )

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

    schedule_result = build_schedule_result(
        ranked,
        settings,
        now=now,
        existing_tasks=open_tasks,
        existing_candidates=active_suggestion_candidates,
        preferred_focus_hours=preferred_focus_hours,
    )
    created_suggestions: list[tuple[AiScheduleSuggestion, Task]] = []
    for position, (task, start, end, explanation) in enumerate(schedule_result.slots):
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
        schedule=_chronological_schedule(
            [
                *[
                    _to_schedule_response(suggestion, task_by_id[suggestion.task_id])
                    for suggestion in retained_suggestions
                    if suggestion.task_id in task_by_id
                ],
                *[
                    _to_schedule_response(suggestion, task)
                    for suggestion, task in created_suggestions
                ],
            ]
        ),
        issues=[_to_issue_response(issue) for issue in schedule_result.issues],
        generated_at=now,
    )


def get_current_plan(db: Session, user_id: uuid.UUID) -> SchedulingPlanResponse:
    now = utc_now()
    settings = settings_service.get_or_create_user_settings(db, user_id)
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
    open_tasks = _open_tasks(db, user_id)
    active_suggestion_candidates = _active_suggestion_candidates(db, user_id)
    capacity_windows = free_windows_for_current_state(
        settings=settings,
        now=now,
        existing_tasks=open_tasks,
        existing_candidates=active_suggestion_candidates,
    )
    ranked_for_issues = rank_open_tasks(
        open_tasks,
        settings,
        now=now,
        preferred_focus_hours=_preferred_focus_hours(
            db,
            user_id,
            timezone_name=settings.timezone,
        ),
        dismissed_task_ids=_recently_dismissed_task_ids(db, user_id),
        capacity_windows=capacity_windows,
    )
    horizon = planning_horizon_for_scheduling(now)
    suggested_task_ids = {suggestion.task_id for suggestion in suggestions}
    issues = scheduling_issues_for_final_state(
        ranked=ranked_for_issues,
        settings=settings,
        windows=capacity_windows,
        planning_horizon_end=horizon.end,
        scheduled_task_ids=suggested_task_ids,
        existing_tasks=open_tasks,
        existing_candidates=active_suggestion_candidates,
    )

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
        schedule=_chronological_schedule(
            [
                _to_schedule_response(item, tasks[item.task_id])
                for item in suggestions
                if item.task_id in tasks
            ]
        ),
        issues=[_to_issue_response(issue) for issue in issues],
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
