from datetime import UTC, datetime
from uuid import UUID

from app.ai.contracts import AIInvocationContext
from app.ai.policies import AIFeature, get_ai_feature_policy
from app.ai.schemas import AIGenerationMetadata
from app.config import get_settings
from app.tasks.duration_estimation import engine, repository
from app.tasks.duration_estimation.models import DurationEstimateDecision
from app.tasks.duration_estimation.prompt import build_duration_prior_prompt
from app.tasks.duration_estimation.proposal import (
    DurationConflict,
    create_proposal,
    request_fingerprint,
    task_snapshot,
    verify_proposal,
)
from app.tasks.duration_estimation.schemas import (
    MAX_DURATION_MINUTES,
    DurationConfirmResponse,
    DurationPreviewResponse,
    GeminiDurationPrior,
)
from app.tasks.models import TaskStatus


def preview_duration_estimate(db, *, user_id, task_id, ai_service):
    task = repository.get_owned_task(db, user_id=user_id, task_id=task_id)
    if task.status == TaskStatus.DONE:
        raise DurationConflict("Completed tasks cannot receive a new duration estimate.")
    now = datetime.now(UTC)
    settings = repository.get_user_settings(db, user_id=user_id)
    history = engine.summarize_history(
        title=task.title,
        description=task.description,
        project_id=task.project_id,
        samples=repository.load_duration_history(
            db, user_id=user_id, target_task_id=task_id, now=now
        ),
    )
    policy = get_ai_feature_policy(AIFeature.DURATION_ESTIMATION)
    if history.similar and history.count:
        fallback_minutes, source = engine.round_duration(history.actual_median), "history"
    elif task.estimated_duration_minutes:
        fallback_minutes, source = (
            min(MAX_DURATION_MINUTES, task.estimated_duration_minutes),
            "current_estimate",
        )
    else:
        fallback_minutes, source = settings.pomodoro_minutes if settings else 25, "default"
    enough_history = history.similar and history.count >= engine.MIN_SIMILAR_HISTORY
    user_ai_enabled = settings is None or settings.ai_assistant_enabled
    use_ai = get_settings().ai_enabled and user_ai_enabled and not enough_history
    metadata = AIGenerationMetadata(
        feature=policy.feature.value,
        prompt_version=policy.prompt_version,
        source="deterministic_fallback",
        model="none",
        latency_ms=0,
        fallback_reason="history_sufficient" if enough_history else "ai_disabled",
    )
    prior_minutes = fallback_minutes
    if use_ai:
        context = AIInvocationContext(
            requested_at=now,
            timezone=settings.timezone if settings else "UTC",
            facts={"duration_kind": "total_active_work", "historical_sample_count": history.count},
        )
        result = ai_service.generate_structured(
            user_key=str(user_id),
            prompt=build_duration_prior_prompt(task, context),
            response_schema=GeminiDurationPrior,
            feature=policy.feature,
            prompt_version=policy.prompt_version,
            fallback=lambda: GeminiDurationPrior(
                estimated_duration_minutes=fallback_minutes,
                explanation="Deterministic fallback from recorded history or saved settings.",
            ),
        )
        metadata = result.metadata
        prior_minutes = result.data.estimated_duration_minutes
        if result.metadata.source != "deterministic_fallback":
            source = "ai_prior"
    estimate = engine.combine_estimate(prior_minutes=prior_minutes, source=source, history=history)
    return DurationPreviewResponse(
        feature=policy.feature.value,
        prompt_version=policy.prompt_version,
        generated_at=now,
        proposal=create_proposal(estimate, user_id=user_id, task=task, now=now),
        metadata=metadata,
    )


def confirm_duration_estimate(db, *, user_id, task_id, payload):
    claims = verify_proposal(payload.proposal_token, user_id=user_id, task_id=task_id)
    proposal_id = UUID(claims["jti"])
    fingerprint = request_fingerprint(
        payload.proposal_token, payload.action, payload.duration_minutes
    )
    # Every proposal for this task serializes on the same row, including simultaneous first use.
    task = repository.get_owned_task(db, user_id=user_id, task_id=task_id, lock=True)
    existing = repository.get_decision(
        db, user_id=user_id, task_id=task_id, proposal_id=proposal_id
    )
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise DurationConflict("This estimate was already resolved with a different choice.")
        return DurationConfirmResponse.model_validate(existing.response)
    now = datetime.now(UTC)
    if now.timestamp() >= claims["exp"]:
        raise DurationConflict("This estimate expired. Request a new estimate.")
    if payload.action != "ignored" and (
        task.status == TaskStatus.DONE or task_snapshot(task) != claims["snapshot"]
    ):
        raise DurationConflict("Task changed after this estimate. Request a new estimate.")
    applied = None
    if payload.action == "accepted":
        applied = claims["estimate"]["suggested_duration_minutes"]
    elif payload.action == "changed":
        applied = payload.duration_minutes
        if applied == claims["estimate"]["suggested_duration_minutes"]:
            raise ValueError("Use accepted when keeping the suggested duration.")
    if applied is not None:
        task.estimated_duration_minutes = applied
        task.updated_at = now
        from app.scheduling.service import invalidate_pending_plan

        invalidate_pending_plan(db, user_id, commit=False)
    response = DurationConfirmResponse(
        proposal_id=proposal_id,
        task_id=task_id,
        action=payload.action,
        applied_duration_minutes=applied,
        task_estimated_duration_minutes=task.estimated_duration_minutes,
        resolved_at=now,
    )
    db.add(
        DurationEstimateDecision(
            proposal_id=proposal_id,
            user_id=user_id,
            task_id=task_id,
            action=payload.action,
            applied_duration_minutes=applied,
            request_fingerprint=fingerprint,
            task_snapshot_after=task_snapshot(task),
            estimate=claims["estimate"],
            response=response.model_dump(mode="json"),
            resolved_at=now,
        )
    )
    db.commit()
    return response
