from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.focus.models import FocusSession, FocusSessionStatus
from app.scoring.constraints import normalize_schedule_datetime, validate_schedule_candidate
from app.settings.models import UserSettings
from app.tasks import service as task_service
from app.tasks.models import Task, TaskStatus

from .detection import ReschedulingDetectionResult, detect_rescheduling_needs
from .models import RescheduleProposal, RescheduleProposalStatus
from .rescheduling import RescheduleGenerationResult, generate_rescheduling_options
from .revision import bump_schedule_revision, lock_schedule_revision
from .schemas import (
    PersistedRescheduleContext,
    RescheduleConflictCode,
    RescheduleDetectedChange,
    RescheduleFocusSnapshot,
    RescheduleOption,
    RescheduleProposalContext,
    RescheduleProposalResponse,
    RescheduleSettingsSnapshot,
    RescheduleStateSnapshot,
    RescheduleTaskSnapshot,
    SchedulingIssueResponse,
)
from .windows import scheduling_required_minutes

DEFAULT_PROPOSAL_TTL = timedelta(minutes=30)


class RescheduleLifecycleConflict(Exception):
    def __init__(self, code: RescheduleConflictCode, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ReschedulePreviewResult:
    proposal: RescheduleProposal
    detection: ReschedulingDetectionResult
    generation: RescheduleGenerationResult


@dataclass(frozen=True)
class RescheduleApplyResult:
    proposal: RescheduleProposal
    option: RescheduleOption
    idempotent: bool = False


@dataclass(frozen=True)
class RescheduleUndoResult:
    proposal: RescheduleProposal
    idempotent: bool = False


def _aware(value: datetime) -> datetime:
    return normalize_schedule_datetime(value)


def _task_snapshot(task: Task) -> RescheduleTaskSnapshot:
    if task.updated_at is None:
        raise RuntimeError("Persisted task is missing updated_at")
    return RescheduleTaskSnapshot(
        task_id=task.id,
        updated_at=_aware(task.updated_at),
        status=task.status,
        priority=task.priority,
        estimated_duration_minutes=task.estimated_duration_minutes,
        due_date=_aware(task.due_date) if task.due_date is not None else None,
        scheduled_start=(
            _aware(task.scheduled_start) if task.scheduled_start is not None else None
        ),
        scheduled_end=(_aware(task.scheduled_end) if task.scheduled_end is not None else None),
        schedule_locked=task.schedule_locked,
    )


def build_reschedule_state_snapshot(
    *,
    revision: int,
    settings: UserSettings,
    tasks: list[Task],
    focus_sessions: list[FocusSession],
) -> RescheduleStateSnapshot:
    if settings.updated_at is None:
        raise RuntimeError("Persisted settings are missing updated_at")
    return RescheduleStateSnapshot(
        revision=revision,
        settings=RescheduleSettingsSnapshot(
            updated_at=_aware(settings.updated_at),
            work_start=settings.work_start.strftime("%H:%M"),
            work_end=settings.work_end.strftime("%H:%M"),
            timezone=settings.timezone,
            pomodoro_minutes=settings.pomodoro_minutes,
            deadline_urgency_weight=settings.ai_deadline_urgency_weight,
            priority_weight=settings.ai_priority_weight,
            estimated_duration_weight=settings.ai_estimated_duration_weight,
        ),
        tasks=[_task_snapshot(task) for task in sorted(tasks, key=lambda item: str(item.id))],
        focus_sessions=[
            RescheduleFocusSnapshot(
                session_id=session.id,
                task_id=session.task_id,
                status=session.status,
                started_at=_aware(session.started_at),
                planned_duration_minutes=session.planned_duration_minutes,
                actual_duration_seconds=session.actual_duration_seconds,
                updated_at=_aware(session.updated_at),
            )
            for session in sorted(focus_sessions, key=lambda item: str(item.id))
        ],
    )


def state_snapshot_fingerprint(snapshot: RescheduleStateSnapshot) -> str:
    canonical = json.dumps(
        snapshot.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def _load_locked_state(
    db: Session,
    user_id: uuid.UUID,
    *,
    revision: int,
) -> tuple[UserSettings, list[Task], list[FocusSession], RescheduleStateSnapshot]:
    settings = db.scalar(
        select(UserSettings).where(UserSettings.user_id == user_id).with_for_update()
    )
    if settings is None:
        settings = UserSettings(user_id=user_id)
        db.add(settings)
        db.flush()
        db.refresh(settings)

    tasks = list(
        db.scalars(
            select(Task).where(Task.user_id == user_id).order_by(Task.id).with_for_update()
        ).all()
    )
    focus_sessions = list(
        db.scalars(
            select(FocusSession)
            .where(
                FocusSession.user_id == user_id,
                FocusSession.status.in_(
                    [
                        FocusSessionStatus.ACTIVE.value,
                        FocusSessionStatus.PAUSED.value,
                    ]
                ),
            )
            .order_by(FocusSession.id)
            .with_for_update()
        ).all()
    )
    snapshot = build_reschedule_state_snapshot(
        revision=revision,
        settings=settings,
        tasks=tasks,
        focus_sessions=focus_sessions,
    )
    return settings, tasks, focus_sessions, snapshot


def _issue_response(issue) -> SchedulingIssueResponse:
    return SchedulingIssueResponse(
        task_id=issue.task_id,
        task_title=issue.task_title,
        code=issue.code,
        severity=issue.severity,
        reason=issue.reason,
        metadata=issue.metadata,
    )


def _proposal_context(
    detection: ReschedulingDetectionResult,
    *,
    timezone: str,
) -> RescheduleProposalContext:
    return RescheduleProposalContext(
        timezone=timezone,
        changes=[
            RescheduleDetectedChange(
                code=change.code,
                reason=change.reason,
                task_id=change.task_id,
                related_task_ids=list(change.related_task_ids),
            )
            for change in detection.changes
        ],
        affected_task_ids=list(detection.affected_task_ids),
        fixed_task_ids=list(detection.fixed_task_ids),
    )


def _stored_options(proposal: RescheduleProposal) -> list[RescheduleOption]:
    return [RescheduleOption.model_validate(item) for item in proposal.alternatives]


def serialize_reschedule_proposal(
    proposal: RescheduleProposal,
    *,
    idempotent: bool = False,
) -> RescheduleProposalResponse:
    """Build the public contract exclusively from persisted server state."""
    persisted = PersistedRescheduleContext.model_validate(proposal.detected_context)
    if proposal.created_at is None:
        raise RuntimeError("Persisted reschedule proposal is missing created_at")
    return RescheduleProposalResponse(
        id=proposal.id,
        status=proposal.status,
        context=persisted.context,
        options=_stored_options(proposal),
        issues=persisted.issues,
        selected_option_id=proposal.selected_option_id,
        generated_at=_aware(proposal.created_at),
        expires_at=_aware(proposal.expires_at),
        applied_at=_aware(proposal.applied_at) if proposal.applied_at is not None else None,
        undone_at=_aware(proposal.undone_at) if proposal.undone_at is not None else None,
        idempotent=idempotent,
    )


def create_reschedule_preview(
    db: Session,
    user_id: uuid.UUID,
    *,
    now: datetime | None = None,
    ttl: timedelta = DEFAULT_PROPOSAL_TTL,
) -> ReschedulePreviewResult:
    generated_at = _aware(now or datetime.now(UTC))
    if ttl <= timedelta(0):
        raise ValueError("Proposal TTL must be positive")

    try:
        revision = lock_schedule_revision(db, user_id)
        settings, tasks, focus_sessions, snapshot = _load_locked_state(
            db,
            user_id,
            revision=revision,
        )
        open_tasks = [task for task in tasks if task.status != TaskStatus.DONE]
        detection = detect_rescheduling_needs(
            tasks=open_tasks,
            settings=settings,
            now=generated_at,
            focus_sessions=focus_sessions,
        )
        generation = generate_rescheduling_options(
            tasks=open_tasks,
            settings=settings,
            detection=detection,
            now=generated_at,
        )
        context = PersistedRescheduleContext(
            context=_proposal_context(detection, timezone=settings.timezone),
            issues=[_issue_response(issue) for issue in generation.issues],
        )

        for existing in db.scalars(
            select(RescheduleProposal)
            .where(
                RescheduleProposal.user_id == user_id,
                RescheduleProposal.status == RescheduleProposalStatus.PREVIEW.value,
            )
            .with_for_update()
        ).all():
            existing.status = RescheduleProposalStatus.SUPERSEDED.value

        proposal = RescheduleProposal(
            user_id=user_id,
            status=RescheduleProposalStatus.PREVIEW.value,
            state_fingerprint=state_snapshot_fingerprint(snapshot),
            detected_context=context.model_dump(mode="json"),
            state_snapshot=snapshot.model_dump(mode="json"),
            alternatives=[option.model_dump(mode="json") for option in generation.options],
            expires_at=generated_at + ttl,
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        return ReschedulePreviewResult(
            proposal=proposal,
            detection=detection,
            generation=generation,
        )
    except Exception:
        db.rollback()
        raise


def _load_proposal_for_update(
    db: Session,
    user_id: uuid.UUID,
    proposal_id: uuid.UUID,
) -> RescheduleProposal:
    proposal = db.scalar(
        select(RescheduleProposal)
        .where(
            RescheduleProposal.id == proposal_id,
            RescheduleProposal.user_id == user_id,
        )
        .with_for_update()
    )
    if proposal is None:
        raise LookupError("Reschedule proposal not found")
    return proposal


def _selected_option(
    proposal: RescheduleProposal,
    option_id: uuid.UUID,
) -> RescheduleOption:
    option = next(
        (item for item in _stored_options(proposal) if item.id == option_id),
        None,
    )
    if option is None:
        raise RescheduleLifecycleConflict(
            "OPTION_NOT_FOUND",
            "Selected option does not belong to this proposal",
        )
    return option


def _validate_option_against_current_state(
    *,
    option: RescheduleOption,
    tasks: list[Task],
    settings: UserSettings,
) -> list[Task]:
    task_by_id = {task.id: task for task in tasks}
    moved_ids = {move.task_id for move in option.moves}
    blockers = [task for task in tasks if task.id not in moved_ids]
    accepted: list[tuple[uuid.UUID, datetime, datetime]] = []
    moved_tasks: list[Task] = []
    for move in option.moves:
        task = task_by_id.get(move.task_id)
        if task is None or task.status == TaskStatus.DONE:
            raise RescheduleLifecycleConflict(
                "STALE_PROPOSAL",
                "A task in the proposal is missing or completed",
            )
        if task.schedule_locked:
            raise RescheduleLifecycleConflict(
                "LOCKED_TASK",
                "A task in the proposal is now locked",
            )
        duration = int((move.proposed_end - move.proposed_start).total_seconds() // 60)
        if duration != scheduling_required_minutes(task, settings):
            raise RescheduleLifecycleConflict(
                "STALE_PROPOSAL",
                "A task duration no longer matches the proposal",
            )
        validation = validate_schedule_candidate(
            task=task,
            start=move.proposed_start,
            end=move.proposed_end,
            settings=settings,
            existing_tasks=blockers,
            existing_candidates=accepted,
        )
        if not validation.valid:
            failed = next(check for check in validation.checks if not check.passed)
            raise RescheduleLifecycleConflict(
                "INVALID_OPTION",
                failed.reason or "Option is no longer valid",
            )
        accepted.append((task.id, move.proposed_start, move.proposed_end))
        moved_tasks.append(task)
    return moved_tasks


def apply_reschedule_proposal(
    db: Session,
    user_id: uuid.UUID,
    proposal_id: uuid.UUID,
    option_id: uuid.UUID,
    *,
    now: datetime | None = None,
) -> RescheduleApplyResult:
    applied_at = _aware(now or datetime.now(UTC))
    try:
        revision = lock_schedule_revision(db, user_id)
        proposal = _load_proposal_for_update(db, user_id, proposal_id)
        option = _selected_option(proposal, option_id)

        if proposal.status == RescheduleProposalStatus.APPLIED.value:
            if proposal.selected_option_id != option_id:
                raise RescheduleLifecycleConflict(
                    "ALREADY_APPLIED",
                    "Proposal was already applied with a different option",
                )
            db.commit()
            return RescheduleApplyResult(proposal=proposal, option=option, idempotent=True)
        if proposal.status != RescheduleProposalStatus.PREVIEW.value:
            raise RescheduleLifecycleConflict(
                "INVALID_PROPOSAL_STATE",
                "Proposal is not available for apply",
            )
        if _aware(proposal.expires_at) <= applied_at:
            proposal.status = RescheduleProposalStatus.EXPIRED.value
            db.commit()
            raise RescheduleLifecycleConflict("EXPIRED_PROPOSAL", "Proposal has expired")

        settings, tasks, focus_sessions, current_snapshot = _load_locked_state(
            db,
            user_id,
            revision=revision,
        )
        stored_snapshot = RescheduleStateSnapshot.model_validate(proposal.state_snapshot)
        if (
            stored_snapshot.revision != revision
            or proposal.state_fingerprint != state_snapshot_fingerprint(current_snapshot)
        ):
            raise RescheduleLifecycleConflict(
                "STALE_PROPOSAL",
                "Scheduling state changed since preview",
            )

        moved_tasks = _validate_option_against_current_state(
            option=option,
            tasks=tasks,
            settings=settings,
        )
        proposal.before_snapshot = stored_snapshot.model_dump(mode="json")
        move_by_task_id = {move.task_id: move for move in option.moves}
        for task in moved_tasks:
            move = move_by_task_id[task.id]
            task_service.mutate_task_schedule_without_commit(
                task,
                scheduled_start=move.proposed_start,
                scheduled_end=move.proposed_end,
            )

        db.flush()
        for task in moved_tasks:
            db.refresh(task)
        next_revision = bump_schedule_revision(db, user_id)
        after_snapshot = build_reschedule_state_snapshot(
            revision=next_revision,
            settings=settings,
            tasks=tasks,
            focus_sessions=focus_sessions,
        )
        proposal.after_snapshot = after_snapshot.model_dump(mode="json")
        proposal.selected_option_id = option.id
        proposal.status = RescheduleProposalStatus.APPLIED.value
        proposal.applied_at = applied_at

        from .service import invalidate_pending_plan

        invalidate_pending_plan(db, user_id, commit=False)
        db.commit()
        db.refresh(proposal)
        return RescheduleApplyResult(proposal=proposal, option=option)
    except Exception:
        db.rollback()
        raise


def undo_reschedule_proposal(
    db: Session,
    user_id: uuid.UUID,
    proposal_id: uuid.UUID,
    *,
    now: datetime | None = None,
) -> RescheduleUndoResult:
    undone_at = _aware(now or datetime.now(UTC))
    try:
        revision = lock_schedule_revision(db, user_id)
        proposal = _load_proposal_for_update(db, user_id, proposal_id)
        if proposal.status == RescheduleProposalStatus.UNDONE.value:
            db.commit()
            return RescheduleUndoResult(proposal=proposal, idempotent=True)
        if proposal.status != RescheduleProposalStatus.APPLIED.value:
            raise RescheduleLifecycleConflict(
                "INVALID_PROPOSAL_STATE",
                "Only an applied proposal can be undone",
            )
        if proposal.selected_option_id is None:
            raise RescheduleLifecycleConflict(
                "INVALID_PROPOSAL_STATE",
                "Applied proposal has no selected option",
            )
        option = _selected_option(proposal, proposal.selected_option_id)
        if proposal.before_snapshot is None or proposal.after_snapshot is None:
            raise RescheduleLifecycleConflict(
                "INVALID_PROPOSAL_STATE",
                "Applied proposal is missing undo snapshots",
            )

        _settings, tasks, _focus_sessions, current_snapshot = _load_locked_state(
            db,
            user_id,
            revision=revision,
        )
        expected_after = RescheduleStateSnapshot.model_validate(proposal.after_snapshot)
        if state_snapshot_fingerprint(current_snapshot) != state_snapshot_fingerprint(
            expected_after
        ):
            raise RescheduleLifecycleConflict(
                "STALE_UNDO",
                "Scheduling state changed after this proposal was applied",
            )

        before = RescheduleStateSnapshot.model_validate(proposal.before_snapshot)
        before_by_id = {task.task_id: task for task in before.tasks}
        current_by_id = {task.id: task for task in tasks}
        moved_tasks: list[Task] = []
        for move in option.moves:
            task = current_by_id.get(move.task_id)
            prior = before_by_id.get(move.task_id)
            if task is None or prior is None:
                raise RescheduleLifecycleConflict(
                    "STALE_UNDO",
                    "A task required for undo no longer exists",
                )
            task_service.mutate_task_schedule_without_commit(
                task,
                scheduled_start=prior.scheduled_start,
                scheduled_end=prior.scheduled_end,
            )
            moved_tasks.append(task)

        db.flush()
        bump_schedule_revision(db, user_id)
        proposal.status = RescheduleProposalStatus.UNDONE.value
        proposal.undone_at = undone_at

        from .service import invalidate_pending_plan

        invalidate_pending_plan(db, user_id, commit=False)
        db.commit()
        db.refresh(proposal)
        return RescheduleUndoResult(proposal=proposal)
    except Exception:
        db.rollback()
        raise
