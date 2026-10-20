import uuid
from datetime import UTC, datetime, time, timedelta

import pytest

from app.scheduling import lifecycle
from app.scheduling.lifecycle import (
    RescheduleLifecycleConflict,
    apply_reschedule_proposal,
    build_reschedule_state_snapshot,
    create_reschedule_preview,
    state_snapshot_fingerprint,
    undo_reschedule_proposal,
)
from app.scheduling.models import RescheduleProposal, RescheduleProposalStatus
from app.scheduling.schemas import RescheduleMove, RescheduleOption
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskPriority, TaskStatus


class _FakeSession:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0
        self.flushes = 0
        self.added: list[object] = []

    class _Rows:
        def all(self) -> list:
            return []

    def add(self, value) -> None:
        self.added.append(value)

    def scalars(self, _statement) -> "_FakeSession._Rows":
        return self._Rows()

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1

    def flush(self) -> None:
        self.flushes += 1

    def refresh(self, _value) -> None:
        return None


def _settings(now: datetime) -> UserSettings:
    return UserSettings(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        work_start=time(9),
        work_end=time(17),
        timezone="UTC",
        pomodoro_minutes=25,
        ai_deadline_urgency_weight=80,
        ai_priority_weight=70,
        ai_estimated_duration_weight=50,
        updated_at=now,
    )


def _task(
    now: datetime,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
) -> Task:
    return Task(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        title="Lifecycle task",
        status=TaskStatus.PENDING,
        priority=TaskPriority.MEDIUM,
        estimated_duration_minutes=60,
        scheduled_start=start,
        scheduled_end=end,
        schedule_locked=False,
        updated_at=now,
    )


def _proposal(
    *,
    user_id: uuid.UUID,
    snapshot,
    option: RescheduleOption,
    now: datetime,
) -> RescheduleProposal:
    return RescheduleProposal(
        id=uuid.uuid4(),
        user_id=user_id,
        status=RescheduleProposalStatus.PREVIEW.value,
        state_fingerprint=state_snapshot_fingerprint(snapshot),
        detected_context={"context": {}, "issues": []},
        state_snapshot=snapshot.model_dump(mode="json"),
        alternatives=[option.model_dump(mode="json")],
        expires_at=now + timedelta(minutes=30),
    )


def _patch_lifecycle_state(
    monkeypatch: pytest.MonkeyPatch,
    *,
    proposal: RescheduleProposal,
    revision: int,
    settings: UserSettings,
    tasks: list[Task],
) -> None:
    monkeypatch.setattr(lifecycle, "lock_schedule_revision", lambda _db, _user_id: revision)
    monkeypatch.setattr(
        lifecycle,
        "_load_proposal_for_update",
        lambda _db, _user_id, _proposal_id: proposal,
    )

    def load_state(_db, _user_id, *, revision: int):
        return (
            settings,
            tasks,
            [],
            build_reschedule_state_snapshot(
                revision=revision,
                settings=settings,
                tasks=tasks,
                focus_sessions=[],
            ),
        )

    monkeypatch.setattr(lifecycle, "_load_locked_state", load_state)
    monkeypatch.setattr(
        "app.scheduling.service.invalidate_pending_plan",
        lambda _db, _user_id, *, commit: None,
    )


def test_snapshot_fingerprint_covers_revision_task_membership_and_settings() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    settings = _settings(now)
    task = _task(now)
    first = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[task],
        focus_sessions=[],
    )
    repeated = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[task],
        focus_sessions=[],
    )

    assert state_snapshot_fingerprint(first) == state_snapshot_fingerprint(repeated)
    changed = first.model_copy(update={"revision": 2})
    assert state_snapshot_fingerprint(first) != state_snapshot_fingerprint(changed)

    task.priority = TaskPriority.HIGH
    task_changed = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[task],
        focus_sessions=[],
    )
    assert state_snapshot_fingerprint(first) != state_snapshot_fingerprint(task_changed)

    settings.work_end = time(18)
    settings_changed = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[task],
        focus_sessions=[],
    )
    assert state_snapshot_fingerprint(task_changed) != state_snapshot_fingerprint(settings_changed)

    settings.daily_work_limit_minutes = 360
    daily_limit_changed = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[task],
        focus_sessions=[],
    )
    assert state_snapshot_fingerprint(settings_changed) != state_snapshot_fingerprint(
        daily_limit_changed
    )

    added_task = _task(now)
    task_created = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[task, added_task],
        focus_sessions=[],
    )
    task_deleted = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[added_task],
        focus_sessions=[],
    )
    assert state_snapshot_fingerprint(settings_changed) != state_snapshot_fingerprint(task_created)
    assert state_snapshot_fingerprint(task_created) != state_snapshot_fingerprint(task_deleted)


def test_preview_persists_snapshot_fingerprint_and_options_atomically(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    user_id = uuid.uuid4()
    settings = _settings(now)
    task = _task(
        now,
        start=now.replace(hour=9),
        end=now.replace(hour=10),
    )
    snapshot = build_reschedule_state_snapshot(
        revision=4,
        settings=settings,
        tasks=[task],
        focus_sessions=[],
    )
    db = _FakeSession()
    monkeypatch.setattr(lifecycle, "lock_schedule_revision", lambda _db, _user_id: 4)
    monkeypatch.setattr(
        lifecycle,
        "_load_locked_state",
        lambda _db, _user_id, *, revision: (settings, [task], [], snapshot),
    )

    result = create_reschedule_preview(db, user_id, now=now)

    assert db.commits == 1
    assert db.rollbacks == 0
    assert db.added == [result.proposal]
    assert result.proposal.state_fingerprint == state_snapshot_fingerprint(snapshot)
    assert result.proposal.state_snapshot == snapshot.model_dump(mode="json")
    assert result.proposal.status == RescheduleProposalStatus.PREVIEW.value


def test_apply_and_undo_are_single_commit_and_idempotent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    user_id = uuid.uuid4()
    settings = _settings(now)
    task = _task(
        now,
        start=now.replace(hour=15),
        end=now.replace(hour=16),
    )
    snapshot = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[task],
        focus_sessions=[],
    )
    option = RescheduleOption(
        id=uuid.uuid4(),
        style="minimal_disruption",
        deterministic_rank=1,
        moves=[
            RescheduleMove(
                task_id=task.id,
                task_title=task.title,
                previous_start=task.scheduled_start,
                previous_end=task.scheduled_end,
                proposed_start=now.replace(hour=14),
                proposed_end=now.replace(hour=15),
            )
        ],
        moved_task_count=1,
        total_displacement_minutes=60,
        completion_at=now.replace(hour=15),
    )
    proposal = _proposal(user_id=user_id, snapshot=snapshot, option=option, now=now)
    db = _FakeSession()
    _patch_lifecycle_state(
        monkeypatch,
        proposal=proposal,
        revision=1,
        settings=settings,
        tasks=[task],
    )
    monkeypatch.setattr(lifecycle, "bump_schedule_revision", lambda _db, _user_id: 2)

    applied = apply_reschedule_proposal(db, user_id, proposal.id, option.id, now=now)

    assert not applied.idempotent
    assert db.commits == 1
    assert task.scheduled_start == now.replace(hour=14)
    assert proposal.status == RescheduleProposalStatus.APPLIED.value
    assert proposal.before_snapshot is not None
    assert proposal.after_snapshot is not None

    duplicate = apply_reschedule_proposal(db, user_id, proposal.id, option.id, now=now)
    assert duplicate.idempotent
    assert db.commits == 2

    _patch_lifecycle_state(
        monkeypatch,
        proposal=proposal,
        revision=2,
        settings=settings,
        tasks=[task],
    )
    monkeypatch.setattr(lifecycle, "bump_schedule_revision", lambda _db, _user_id: 3)

    undone = undo_reschedule_proposal(db, user_id, proposal.id, now=now)

    assert not undone.idempotent
    assert db.commits == 3
    assert task.scheduled_start == now.replace(hour=15)
    assert proposal.status == RescheduleProposalStatus.UNDONE.value

    duplicate_undo = undo_reschedule_proposal(db, user_id, proposal.id, now=now)
    assert duplicate_undo.idempotent
    assert db.commits == 4


def test_stale_apply_rolls_back_without_mutating_schedule(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    user_id = uuid.uuid4()
    settings = _settings(now)
    task = _task(now)
    snapshot = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[task],
        focus_sessions=[],
    )
    option = RescheduleOption(
        id=uuid.uuid4(),
        style="best_v7_fit",
        deterministic_rank=1,
        moves=[
            RescheduleMove(
                task_id=task.id,
                task_title=task.title,
                proposed_start=now.replace(hour=9),
                proposed_end=now.replace(hour=10),
            )
        ],
        moved_task_count=1,
        total_displacement_minutes=0,
        completion_at=now.replace(hour=10),
    )
    proposal = _proposal(user_id=user_id, snapshot=snapshot, option=option, now=now)
    task.priority = TaskPriority.HIGH
    db = _FakeSession()
    _patch_lifecycle_state(
        monkeypatch,
        proposal=proposal,
        revision=2,
        settings=settings,
        tasks=[task],
    )

    with pytest.raises(RescheduleLifecycleConflict, match="changed since preview"):
        apply_reschedule_proposal(db, user_id, proposal.id, option.id, now=now)

    assert db.commits == 0
    assert db.rollbacks == 1
    assert task.scheduled_start is None


def test_apply_rolls_back_when_a_later_task_mutation_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    user_id = uuid.uuid4()
    settings = _settings(now)
    first = _task(now)
    second = _task(now)
    snapshot = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[first, second],
        focus_sessions=[],
    )
    option = RescheduleOption(
        id=uuid.uuid4(),
        style="earlier_completion",
        deterministic_rank=1,
        moves=[
            RescheduleMove(
                task_id=first.id,
                task_title=first.title,
                proposed_start=now.replace(hour=9),
                proposed_end=now.replace(hour=10),
            ),
            RescheduleMove(
                task_id=second.id,
                task_title=second.title,
                proposed_start=now.replace(hour=10),
                proposed_end=now.replace(hour=11),
            ),
        ],
        moved_task_count=2,
        total_displacement_minutes=0,
        completion_at=now.replace(hour=11),
    )
    proposal = _proposal(user_id=user_id, snapshot=snapshot, option=option, now=now)
    db = _FakeSession()
    _patch_lifecycle_state(
        monkeypatch,
        proposal=proposal,
        revision=1,
        settings=settings,
        tasks=[first, second],
    )
    real_mutation = lifecycle.task_service.mutate_task_schedule_without_commit
    calls = 0

    def fail_second(task, *, scheduled_start, scheduled_end):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("simulated mutation failure")
        real_mutation(
            task,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
        )

    monkeypatch.setattr(
        lifecycle.task_service,
        "mutate_task_schedule_without_commit",
        fail_second,
    )

    with pytest.raises(RuntimeError, match="simulated mutation failure"):
        apply_reschedule_proposal(db, user_id, proposal.id, option.id, now=now)

    assert db.commits == 0
    assert db.rollbacks == 1
    assert proposal.status == RescheduleProposalStatus.PREVIEW.value


def test_undo_rejects_state_changed_after_apply(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    user_id = uuid.uuid4()
    settings = _settings(now)
    task = _task(
        now,
        start=now.replace(hour=14),
        end=now.replace(hour=15),
    )
    option = RescheduleOption(
        id=uuid.uuid4(),
        style="minimal_disruption",
        deterministic_rank=1,
        moves=[
            RescheduleMove(
                task_id=task.id,
                task_title=task.title,
                previous_start=now.replace(hour=15),
                previous_end=now.replace(hour=16),
                proposed_start=task.scheduled_start,
                proposed_end=task.scheduled_end,
            )
        ],
        moved_task_count=1,
        total_displacement_minutes=60,
        completion_at=now.replace(hour=15),
    )
    expected_after = build_reschedule_state_snapshot(
        revision=2,
        settings=settings,
        tasks=[task],
        focus_sessions=[],
    )
    before = expected_after.model_copy(
        update={
            "revision": 1,
            "tasks": [
                expected_after.tasks[0].model_copy(
                    update={
                        "scheduled_start": now.replace(hour=15),
                        "scheduled_end": now.replace(hour=16),
                    }
                )
            ],
        }
    )
    proposal = _proposal(user_id=user_id, snapshot=before, option=option, now=now)
    proposal.status = RescheduleProposalStatus.APPLIED.value
    proposal.selected_option_id = option.id
    proposal.before_snapshot = before.model_dump(mode="json")
    proposal.after_snapshot = expected_after.model_dump(mode="json")
    task.priority = TaskPriority.HIGH
    db = _FakeSession()
    _patch_lifecycle_state(
        monkeypatch,
        proposal=proposal,
        revision=3,
        settings=settings,
        tasks=[task],
    )

    with pytest.raises(RescheduleLifecycleConflict, match="changed after"):
        undo_reschedule_proposal(db, user_id, proposal.id, now=now)

    assert db.commits == 0
    assert db.rollbacks == 1
    assert task.scheduled_start == now.replace(hour=14)


def test_apply_rejects_different_option_after_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    user_id = uuid.uuid4()
    settings = _settings(now)
    task = _task(now)
    first = RescheduleOption(
        id=uuid.uuid4(),
        style="minimal_disruption",
        deterministic_rank=1,
        moves=[
            RescheduleMove(
                task_id=task.id,
                task_title=task.title,
                proposed_start=now.replace(hour=9),
                proposed_end=now.replace(hour=10),
            )
        ],
        moved_task_count=1,
        total_displacement_minutes=0,
        completion_at=now.replace(hour=10),
    )
    second = first.model_copy(
        update={
            "id": uuid.uuid4(),
            "style": "earlier_completion",
            "deterministic_rank": 2,
        }
    )
    snapshot = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[task],
        focus_sessions=[],
    )
    proposal = _proposal(user_id=user_id, snapshot=snapshot, option=first, now=now)
    proposal.alternatives.append(second.model_dump(mode="json"))
    proposal.status = RescheduleProposalStatus.APPLIED.value
    proposal.selected_option_id = first.id
    db = _FakeSession()
    _patch_lifecycle_state(
        monkeypatch,
        proposal=proposal,
        revision=2,
        settings=settings,
        tasks=[task],
    )

    with pytest.raises(RescheduleLifecycleConflict, match="different option"):
        apply_reschedule_proposal(db, user_id, proposal.id, second.id, now=now)

    assert db.commits == 0
    assert db.rollbacks == 1


def test_expired_proposal_is_marked_and_not_applied(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    user_id = uuid.uuid4()
    settings = _settings(now)
    task = _task(now)
    option = RescheduleOption(
        id=uuid.uuid4(),
        style="best_v7_fit",
        deterministic_rank=1,
        moves=[
            RescheduleMove(
                task_id=task.id,
                task_title=task.title,
                proposed_start=now.replace(hour=9),
                proposed_end=now.replace(hour=10),
            )
        ],
        moved_task_count=1,
        total_displacement_minutes=0,
        completion_at=now.replace(hour=10),
    )
    snapshot = build_reschedule_state_snapshot(
        revision=1,
        settings=settings,
        tasks=[task],
        focus_sessions=[],
    )
    proposal = _proposal(user_id=user_id, snapshot=snapshot, option=option, now=now)
    proposal.expires_at = now
    db = _FakeSession()
    _patch_lifecycle_state(
        monkeypatch,
        proposal=proposal,
        revision=1,
        settings=settings,
        tasks=[task],
    )

    with pytest.raises(RescheduleLifecycleConflict, match="expired"):
        apply_reschedule_proposal(db, user_id, proposal.id, option.id, now=now)

    assert proposal.status == RescheduleProposalStatus.EXPIRED.value
    assert db.commits == 1
    assert task.scheduled_start is None
