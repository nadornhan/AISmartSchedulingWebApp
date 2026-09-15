import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.scheduling import lifecycle, router
from app.scheduling.lifecycle import (
    RescheduleApplyResult,
    RescheduleLifecycleConflict,
    ReschedulePreviewResult,
    RescheduleUndoResult,
)
from app.scheduling.models import RescheduleProposal
from app.scheduling.schemas import (
    PersistedRescheduleContext,
    RescheduleApplyRequest,
    RescheduleMove,
    RescheduleOption,
    ReschedulePreviewRequest,
    RescheduleProposalContext,
)


def _proposal(*, status: str = "preview") -> tuple[RescheduleProposal, RescheduleOption]:
    now = datetime.now(UTC)
    task_id = uuid.uuid4()
    option = RescheduleOption(
        id=uuid.uuid4(),
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
        moved_task_count=1,
        total_displacement_minutes=60,
        completion_at=now + timedelta(hours=1, minutes=30),
    )
    context = PersistedRescheduleContext(
        context=RescheduleProposalContext(
            timezone="UTC",
            changes=[
                {
                    "code": "SCHEDULE_CONFLICT",
                    "reason": "Task overlaps a fixed interval",
                    "task_id": task_id,
                }
            ],
            affected_task_ids=[task_id],
        )
    )
    proposal = RescheduleProposal(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        status=status,
        state_fingerprint="a" * 64,
        detected_context=context.model_dump(mode="json"),
        state_snapshot={},
        alternatives=[option.model_dump(mode="json")],
        selected_option_id=option.id if status != "preview" else None,
        expires_at=now + timedelta(minutes=30),
        created_at=now,
        applied_at=now if status in {"applied", "undone"} else None,
        undone_at=now if status == "undone" else None,
    )
    return proposal, option


def test_reschedule_routes_are_registered() -> None:
    routes = {(route.path, method) for route in router.router.routes for method in route.methods}

    assert ("/scheduling/reschedule/preview", "POST") in routes
    assert ("/scheduling/reschedule/{proposal_id}/apply", "POST") in routes
    assert ("/scheduling/reschedule/{proposal_id}/undo", "POST") in routes


def test_apply_contract_rejects_client_generated_schedule_data() -> None:
    with pytest.raises(ValidationError, match="extra_forbidden"):
        RescheduleApplyRequest.model_validate(
            {
                "option_id": uuid.uuid4(),
                "proposed_start": datetime.now(UTC),
                "score": 999,
            }
        )


def test_preview_uses_authenticated_user_and_serializes_persisted_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    proposal, _option = _proposal()
    current_user = SimpleNamespace(id=proposal.user_id)
    seen: dict[str, object] = {}

    def create(db, user_id):
        seen.update(db=db, user_id=user_id)
        return ReschedulePreviewResult(
            proposal=proposal,
            detection=SimpleNamespace(),
            generation=SimpleNamespace(),
        )

    monkeypatch.setattr(lifecycle, "create_reschedule_preview", create)

    response = router.preview_reschedule(
        ReschedulePreviewRequest(include_ai_explanations=False),
        "db",
        current_user,
    )

    assert seen == {"db": "db", "user_id": proposal.user_id}
    assert response.id == proposal.id
    assert response.options[0].id == uuid.UUID(proposal.alternatives[0]["id"])
    assert response.idempotent is False


def test_apply_accepts_only_option_id_and_reports_idempotency(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    proposal, option = _proposal(status="applied")
    current_user = SimpleNamespace(id=proposal.user_id)
    seen: dict[str, object] = {}

    def apply(db, user_id, proposal_id, option_id):
        seen.update(
            db=db,
            user_id=user_id,
            proposal_id=proposal_id,
            option_id=option_id,
        )
        return RescheduleApplyResult(
            proposal=proposal,
            option=option,
            idempotent=True,
        )

    monkeypatch.setattr(lifecycle, "apply_reschedule_proposal", apply)

    response = router.apply_reschedule(
        proposal.id,
        RescheduleApplyRequest(option_id=option.id),
        "db",
        current_user,
    )

    assert seen["user_id"] == proposal.user_id
    assert seen["proposal_id"] == proposal.id
    assert seen["option_id"] == option.id
    assert response.status == "applied"
    assert response.idempotent is True


def test_undo_uses_authenticated_user_and_reports_idempotency(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    proposal, _option = _proposal(status="undone")
    current_user = SimpleNamespace(id=proposal.user_id)
    seen: dict[str, object] = {}

    def undo(db, user_id, proposal_id):
        seen.update(db=db, user_id=user_id, proposal_id=proposal_id)
        return RescheduleUndoResult(proposal=proposal, idempotent=True)

    monkeypatch.setattr(lifecycle, "undo_reschedule_proposal", undo)

    response = router.undo_reschedule(proposal.id, "db", current_user)

    assert seen["user_id"] == proposal.user_id
    assert seen["proposal_id"] == proposal.id
    assert response.status == "undone"
    assert response.idempotent is True


@pytest.mark.parametrize("operation", ["apply", "undo"])
def test_mutation_hides_missing_or_foreign_proposals(
    monkeypatch: pytest.MonkeyPatch,
    operation: str,
) -> None:
    proposal_id = uuid.uuid4()
    current_user = SimpleNamespace(id=uuid.uuid4())

    def missing(*_args):
        raise LookupError("sensitive lookup detail")

    if operation == "apply":
        monkeypatch.setattr(lifecycle, "apply_reschedule_proposal", missing)
        call = lambda: router.apply_reschedule(
            proposal_id,
            RescheduleApplyRequest(option_id=uuid.uuid4()),
            "db",
            current_user,
        )
    else:
        monkeypatch.setattr(lifecycle, "undo_reschedule_proposal", missing)
        call = lambda: router.undo_reschedule(proposal_id, "db", current_user)

    with pytest.raises(HTTPException) as caught:
        call()

    assert caught.value.status_code == 404
    assert caught.value.detail == "Reschedule proposal not found"


@pytest.mark.parametrize("operation", ["preview", "apply", "undo"])
def test_lifecycle_conflicts_are_returned_as_typed_409_errors(
    monkeypatch: pytest.MonkeyPatch,
    operation: str,
) -> None:
    proposal_id = uuid.uuid4()
    option_id = uuid.uuid4()
    current_user = SimpleNamespace(id=uuid.uuid4())

    def conflict(*_args):
        raise RescheduleLifecycleConflict("STALE_PROPOSAL", "State changed")

    if operation == "preview":
        monkeypatch.setattr(lifecycle, "create_reschedule_preview", conflict)
        call = lambda: router.preview_reschedule(
            ReschedulePreviewRequest(), "db", current_user
        )
    elif operation == "apply":
        monkeypatch.setattr(lifecycle, "apply_reschedule_proposal", conflict)
        call = lambda: router.apply_reschedule(
            proposal_id,
            RescheduleApplyRequest(option_id=option_id),
            "db",
            current_user,
        )
    else:
        monkeypatch.setattr(lifecycle, "undo_reschedule_proposal", conflict)
        call = lambda: router.undo_reschedule(proposal_id, "db", current_user)

    with pytest.raises(HTTPException) as caught:
        call()

    assert caught.value.status_code == 409
    assert caught.value.detail == {
        "code": "STALE_PROPOSAL",
        "message": "State changed",
    }
