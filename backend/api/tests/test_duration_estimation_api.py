from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from uuid import UUID

import pytest
from sqlalchemy import func, select

from app.ai import get_ai_service
from app.ai.exceptions import AIQuotaError
from app.ai.fake import FakeAIProvider, InMemoryAITelemetryRecorder
from app.ai.limiter import AIRequestLimiter
from app.ai.service import AIService
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.config import get_settings
from app.database import SessionLocal
from app.main import app
from app.settings.models import UserSettings
from app.tasks.duration_estimation import service
from app.tasks.duration_estimation.models import DurationEstimateDecision, TaskDurationBaseline
from app.tasks.duration_estimation.proposal import create_proposal
from app.tasks.duration_estimation.repository import get_owned_task
from app.tasks.duration_estimation.schemas import DurationConfirmRequest, DurationEstimate
from app.tasks.models import Task
from tests.test_duration_estimation_history import make_history_task, make_user


@pytest.fixture
def setup_duration(client, db_session, monkeypatch):
    user = make_user(db_session)
    task = Task(user_id=user.id, title="Write course report", estimated_duration_minutes=30)
    db_session.add(task)
    db_session.flush()
    app.dependency_overrides[get_current_user] = lambda: user
    fake = FakeAIProvider(
        [{"estimated_duration_minutes": 60, "explanation": "Writing and reviewing."}] * 10
    )
    telemetry = InMemoryAITelemetryRecorder()
    ai = AIService(fake, AIRequestLimiter(100), telemetry)
    app.dependency_overrides[get_ai_service] = lambda: ai
    monkeypatch.setattr(get_settings(), "ai_enabled", True)
    return user, task, fake, telemetry


def preview(client, task):
    response = client.post(f"/tasks/{task.id}/duration/preview")
    assert response.status_code == 200, response.text
    return response.json()


def confirm(client, task, proposal, action="accepted", minutes=None):
    body = {"proposal_token": proposal["proposal_token"], "action": action}
    if minutes is not None:
        body["duration_minutes"] = minutes
    return client.post(f"/tasks/{task.id}/duration/confirm", json=body)


def test_preview_shared_contract_telemetry_and_zero_business_writes(
    client, db_session, setup_duration, monkeypatch
):
    _, task, fake, telemetry = setup_duration
    old_updated = task.updated_at
    db_session.autoflush = (
        False  # Match production SessionLocal; no-op ORM autoflush isn't a write.
    )

    def forbid(*args, **kwargs):
        pytest.fail("Preview must not write business data")

    for name in ("add", "commit", "flush"):
        monkeypatch.setattr(db_session, name, forbid)
    result = preview(client, task)
    assert result["status"] == "preview" and result["requires_confirmation"] is True
    assert result["context_schema_version"] == "ai-context-v1"
    assert result["proposal"]["suggested_duration_minutes"] == 60
    assert result["proposal"]["historical_sample_count"] == 0
    assert task.estimated_duration_minutes == 30 and task.updated_at == old_updated
    assert len(fake.calls) == 1
    assert '"schema_version":"ai-context-v1"' in fake.calls[0]["prompt"]
    assert telemetry.events[0].feature == "duration_estimation"


@pytest.mark.parametrize(
    "action, minutes, applied",
    [("accepted", None, 60), ("changed", 90, 90), ("ignored", None, None)],
)
def test_confirmation_idempotent(client, db_session, setup_duration, action, minutes, applied):
    _, task, _, _ = setup_duration
    proposal = preview(client, task)["proposal"]
    first = confirm(client, task, proposal, action, minutes)
    assert first.status_code == 200, first.text
    updated_at = db_session.get(Task, task.id).updated_at
    second = confirm(client, task, proposal, action, minutes)
    assert second.status_code == 200 and first.json() == second.json()
    assert second.json()["applied_duration_minutes"] == applied
    db_session.refresh(task)
    assert task.estimated_duration_minutes == (applied if applied else 30)
    assert task.updated_at == updated_at
    assert db_session.scalar(select(func.count()).select_from(DurationEstimateDecision)) == 1


def test_changed_retry_must_match_duration(client, setup_duration):
    _, task, _, _ = setup_duration
    proposal = preview(client, task)["proposal"]
    assert confirm(client, task, proposal, "changed", 90).status_code == 200
    assert confirm(client, task, proposal, "changed", 120).status_code == 409


def test_stale_proposal_is_rejected(client, db_session, setup_duration):
    _, task, _, _ = setup_duration
    proposal = preview(client, task)["proposal"]
    task.title = "Different work"
    db_session.flush()
    assert confirm(client, task, proposal).status_code == 409


def test_cross_user_preview_confirm_and_tampering(client, db_session, setup_duration):
    user, task, _, _ = setup_duration
    proposal = preview(client, task)["proposal"]
    other = make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: other
    assert client.post(f"/tasks/{task.id}/duration/preview").status_code == 404
    assert confirm(client, task, proposal).status_code == 404
    app.dependency_overrides[get_current_user] = lambda: user
    token = proposal["proposal_token"]
    proposal["proposal_token"] = ("A" if token[0] != "A" else "B") + token[1:]
    assert confirm(client, task, proposal).status_code == 422


@pytest.mark.parametrize(
    "action, minutes",
    [
        ("changed", None),
        ("changed", -1),
        ("changed", 1.5),
        ("changed", True),
        ("accepted", 20),
        ("ignored", 20),
    ],
)
def test_invalid_confirm_payload(client, setup_duration, action, minutes):
    _, task, _, _ = setup_duration
    proposal = preview(client, task)["proposal"]
    assert confirm(client, task, proposal, action, minutes).status_code == 422


def test_personal_history_changes_prior_and_sufficient_history_skips_ai(
    client, db_session, setup_duration
):
    user, task, fake, _ = setup_duration
    for _ in range(3):
        make_history_task(db_session, user, minutes=(30, 60))
    result = preview(client, task)
    assert result["proposal"]["suggested_duration_minutes"] == 75
    assert result["proposal"]["adjustment_factor"] == 1.25
    make_history_task(db_session, user, minutes=(30, 60))
    result = preview(client, task)
    assert result["proposal"]["source"] == "history"
    assert result["proposal"]["suggested_duration_minutes"] == 90
    assert len(fake.calls) == 1


def test_ai_failure_and_user_opt_out_fallback(client, db_session, setup_duration):
    user, task, fake, _ = setup_duration
    fake.queue(AIQuotaError("quota"))
    failing = FakeAIProvider([AIQuotaError("quota")])
    app.dependency_overrides[get_ai_service] = lambda: AIService(failing, AIRequestLimiter(100))
    result = preview(client, task)
    assert result["proposal"]["source"] == "current_estimate"
    assert result["proposal"]["suggested_duration_minutes"] == 30
    db_session.add(UserSettings(user_id=user.id, ai_assistant_enabled=False, pomodoro_minutes=45))
    task.estimated_duration_minutes = None
    db_session.flush()
    result = preview(client, task)
    assert result["proposal"]["source"] == "default"
    assert result["proposal"]["suggested_duration_minutes"] == 45
    assert len(failing.calls) == 1


def test_expired_proposal(client, setup_duration):
    user, task, _, _ = setup_duration
    estimate = DurationEstimate(
        suggested_duration_minutes=60,
        confidence=0.3,
        historical_sample_count=0,
        adjustment_factor=1,
        explanation="test",
        source="ai_prior",
        prior_minutes=60,
    )
    proposal = create_proposal(
        estimate, user_id=user.id, task=task, now=datetime.now(UTC) - timedelta(hours=1)
    )
    assert confirm(client, task, proposal.model_dump()).status_code == 409


def test_focus_start_captures_prior_before_work(client, db_session, setup_duration):
    _, task, _, _ = setup_duration
    proposal = preview(client, task)["proposal"]
    assert confirm(client, task, proposal).status_code == 200
    response = client.post(
        "/focus/sessions/start", json={"task_id": str(task.id), "planned_duration_minutes": 25}
    )
    assert response.status_code == 201, response.text
    baseline = db_session.get(TaskDurationBaseline, task.id)
    assert baseline.estimated_minutes == 60
    assert baseline.reference_source == "ai_prior_snapshot"


def test_invalid_ai_output_falls_back(client, setup_duration):
    _, task, _, _ = setup_duration
    fake = FakeAIProvider([{"estimated_duration_minutes": -20, "explanation": "bad"}])
    app.dependency_overrides[get_ai_service] = lambda: AIService(fake, AIRequestLimiter(100))
    result = preview(client, task)
    assert result["proposal"]["source"] == "current_estimate"
    assert result["metadata"]["source"] == "deterministic_fallback"


def test_apply_invalidates_pending_scheduling_atomically(client, db_session, setup_duration):
    from app.scheduling.models import AiRecommendation

    user, task, _, _ = setup_duration
    row = AiRecommendation(
        user_id=user.id,
        task_id=task.id,
        kind="test",
        title="test",
        explanation="test",
        status="pending",
    )
    db_session.add(row)
    db_session.flush()
    proposal = preview(client, task)["proposal"]
    assert confirm(client, task, proposal).status_code == 200
    db_session.refresh(row)
    assert row.status == "superseded"


def test_preview_requires_authentication(client):
    from uuid import uuid4

    assert client.post(f"/tasks/{uuid4()}/duration/preview").status_code in {401, 403}


def test_two_proposals_cannot_overwrite_each_other(client, setup_duration):
    _, task, _, _ = setup_duration
    first, second = preview(client, task)["proposal"], preview(client, task)["proposal"]
    assert confirm(client, task, first).status_code == 200
    assert confirm(client, task, second).status_code == 409


def test_atomic_rollback_if_invalidation_fails(client, db_session, setup_duration, monkeypatch):
    _, task, _, _ = setup_duration
    db_session.commit()  # Keep fixture rows outside the confirmation savepoint being rolled back.
    proposal = preview(client, task)["proposal"]

    def fail(*args, **kwargs):
        raise RuntimeError("test rollback")

    from app.scheduling import service as scheduling

    monkeypatch.setattr(scheduling, "invalidate_pending_plan", fail)
    with pytest.raises(RuntimeError):
        confirm(client, task, proposal)
    # Production closes the request session on unhandled errors; explicitly rollback this test's shared one.
    db_session.rollback()
    db_session.expire_all()
    assert db_session.get(Task, task.id).estimated_duration_minutes == 30
    assert db_session.get(DurationEstimateDecision, UUID(proposal["proposal_id"])) is None


def test_concurrent_confirmation_updates_once():
    # Dedicated committed rows are necessary for real PostgreSQL concurrency, unlike savepoint fixtures.
    with SessionLocal() as db:
        user = make_user(db)
        task = Task(user_id=user.id, title="Concurrency test", estimated_duration_minutes=30)
        db.add(task)
        db.commit()
        uid, tid = user.id, task.id
        task = get_owned_task(db, user_id=uid, task_id=tid)
        estimate = DurationEstimate(
            suggested_duration_minutes=60,
            confidence=0.3,
            historical_sample_count=0,
            adjustment_factor=1,
            explanation="test",
            source="default",
            prior_minutes=60,
        )
        proposal = create_proposal(estimate, user_id=uid, task=task)
    barrier = Barrier(2)

    def worker():
        with SessionLocal() as db:
            barrier.wait(timeout=10)
            return service.confirm_duration_estimate(
                db,
                user_id=uid,
                task_id=tid,
                payload=DurationConfirmRequest(
                    proposal_token=proposal.proposal_token, action="accepted"
                ),
            )

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: worker(), range(2)))
        assert results[0] == results[1]
        with SessionLocal() as db:
            assert db.get(Task, tid).estimated_duration_minutes == 60
            assert (
                db.scalar(
                    select(func.count())
                    .select_from(DurationEstimateDecision)
                    .where(DurationEstimateDecision.proposal_id == proposal.proposal_id)
                )
                == 1
            )
    finally:
        with SessionLocal() as db:
            db.delete(db.get(User, uid))
            db.commit()
