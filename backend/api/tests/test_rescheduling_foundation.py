import uuid
from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.scheduling.models import (
    RescheduleProposal,
    RescheduleProposalStatus,
    UserScheduleState,
)
from app.scheduling.schemas import (
    RescheduleMove,
    RescheduleOption,
    RescheduleProposalContext,
    RescheduleProposalResponse,
    RescheduleStateSnapshot,
    RescheduleTaskSnapshot,
)
from app.settings.models import UserSettings
from app.tasks.models import Task
from app.tasks.schemas import TaskCreate


def test_rescheduling_tables_expose_required_foundation_columns() -> None:
    assert "schedule_locked" in Task.__table__.c
    assert Task.__table__.c.schedule_locked.nullable is False
    assert "ck_tasks_locked_schedule_complete" in {
        constraint.name for constraint in Task.__table__.constraints
    }

    columns = RescheduleProposal.__table__.c
    assert {
        "id",
        "user_id",
        "status",
        "state_fingerprint",
        "detected_context",
        "state_snapshot",
        "alternatives",
        "selected_option_id",
        "before_snapshot",
        "after_snapshot",
        "ai_explanations",
        "expires_at",
        "applied_at",
        "undone_at",
        "created_at",
        "updated_at",
    }.issubset(columns.keys())
    assert RescheduleProposalStatus.PREVIEW.value == "preview"
    assert UserScheduleState.__table__.c.revision.nullable is False
    assert UserSettings.__table__.c.daily_work_limit_minutes.nullable is False


def test_locked_task_create_contract_requires_schedule() -> None:
    with pytest.raises(ValidationError, match="complete schedule interval"):
        TaskCreate(title="Missing interval", schedule_locked=True)


def test_state_snapshot_rejects_duplicate_tasks() -> None:
    now = datetime.now(UTC)
    task_id = uuid.uuid4()
    task = RescheduleTaskSnapshot(
        task_id=task_id,
        updated_at=now,
        status="pending",
        priority="medium",
        estimated_duration_minutes=30,
        scheduled_start=now,
        scheduled_end=now + timedelta(minutes=30),
    )

    with pytest.raises(ValidationError, match="duplicate task IDs"):
        RescheduleStateSnapshot(
            revision=0,
            settings={
                "updated_at": now,
                "work_start": "09:00",
                "work_end": "17:00",
                "timezone": "Australia/Sydney",
                "pomodoro_minutes": 25,
                "deadline_urgency_weight": 80,
                "priority_weight": 70,
                "estimated_duration_weight": 50,
            },
            tasks=[task, task],
        )


def test_reschedule_proposal_contract_round_trips_valid_option() -> None:
    now = datetime.now(UTC)
    task_id = uuid.uuid4()
    option_id = uuid.uuid4()
    option = RescheduleOption(
        id=option_id,
        style="minimal_disruption",
        deterministic_rank=1,
        moves=[
            RescheduleMove(
                task_id=task_id,
                task_title="Prepare report",
                previous_start=now,
                previous_end=now + timedelta(minutes=30),
                proposed_start=now + timedelta(hours=1),
                proposed_end=now + timedelta(hours=1, minutes=30),
            )
        ],
        preserved_task_ids=[],
        moved_task_count=1,
        total_displacement_minutes=60,
        completion_at=now + timedelta(hours=1, minutes=30),
        deterministic_reasons=["Avoids an existing fixed interval"],
    )
    response = RescheduleProposalResponse(
        id=uuid.uuid4(),
        status="preview",
        context=RescheduleProposalContext(
            timezone="Australia/Sydney",
            changes=[
                {
                    "code": "SCHEDULE_CONFLICT",
                    "reason": "The task overlaps another scheduled task",
                    "task_id": task_id,
                }
            ],
            affected_task_ids=[task_id],
        ),
        options=[option],
        generated_at=now,
        expires_at=now + timedelta(hours=24),
    )

    restored = RescheduleProposalResponse.model_validate_json(response.model_dump_json())
    assert restored.options[0].id == option_id
    assert restored.options[0].moves[0].task_id == task_id


def test_reschedule_option_rejects_inconsistent_move_count() -> None:
    now = datetime.now(UTC)

    with pytest.raises(ValidationError, match="moved_task_count"):
        RescheduleOption(
            id=uuid.uuid4(),
            style="best_v7_fit",
            deterministic_rank=1,
            moves=[
                {
                    "task_id": uuid.uuid4(),
                    "task_title": "Task",
                    "proposed_start": now,
                    "proposed_end": now + timedelta(minutes=30),
                }
            ],
            moved_task_count=2,
            total_displacement_minutes=0,
            completion_at=now + timedelta(minutes=30),
        )
