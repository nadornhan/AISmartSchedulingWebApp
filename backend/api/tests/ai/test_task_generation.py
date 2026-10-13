import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.ai.fake import FakeAIProvider
from app.ai.limiter import AIRequestLimiter
from app.ai.service import AIService
from app.auth.models import User
from app.tasks import generation_service
from app.tasks.generation_schemas import (
    GeneratedTaskDraft,
    TaskGenerationConfirmRequest,
)
from app.tasks.models import Task, TaskPriority, TaskStatus


def _user(db_session):
    user = User(
        email=f"generated-{uuid.uuid4()}@example.com",
        password_hash="test",
    )
    db_session.add(user)
    db_session.flush()
    return user


def _ai(*responses):
    return AIService(
        FakeAIProvider(list(responses)),
        AIRequestLimiter(100),
    )


def test_parser_preview_does_not_write_and_confirmation_creates_pending_tasks(
    db_session, monkeypatch
):
    user = _user(db_session)
    monkeypatch.setattr(
        generation_service,
        "get_settings",
        lambda: SimpleNamespace(ai_enabled=False),
    )
    preview = generation_service.preview(
        db_session,
        user_id=user.id,
        prompt="Write report today, high priority; Review slides tomorrow",
        ai_service=_ai(),
    )

    assert len(preview.proposal.tasks) == 2
    assert preview.metadata.source == "deterministic_fallback"
    assert (
        db_session.scalar(select(func.count()).select_from(Task).where(Task.user_id == user.id))
        == 0
    )
    assert all(task.due_date is not None for task in preview.proposal.tasks)

    edited = [task.model_copy() for task in preview.proposal.tasks]
    edited[0].title = "Edited report title"
    result = generation_service.confirm(
        db_session,
        user_id=user.id,
        payload=TaskGenerationConfirmRequest(
            proposal_token=preview.proposal.proposal_token,
            tasks=edited,
        ),
    )

    assert [task.title for task in result.created] == [
        "Edited report title",
        "Review slides",
    ]
    assert all(task.status == TaskStatus.PENDING for task in result.created)


def test_parser_fallback_splits_sentences_and_understands_tmr(db_session, monkeypatch):
    user = _user(db_session)
    monkeypatch.setattr(
        generation_service,
        "get_settings",
        lambda: SimpleNamespace(ai_enabled=False),
    )
    preview = generation_service.preview(
        db_session,
        user_id=user.id,
        prompt="I have homework due tmr. Also, I have to do laundry",
        ai_service=_ai(),
    )

    assert [task.title for task in preview.proposal.tasks] == ["Homework", "Do laundry"]
    assert preview.proposal.tasks[0].due_date > preview.proposal.tasks[1].due_date


def test_gemini_can_return_multiple_tasks_and_backend_defaults_missing_date(
    db_session, monkeypatch
):
    user = _user(db_session)
    monkeypatch.setattr(
        generation_service,
        "get_settings",
        lambda: SimpleNamespace(ai_enabled=True),
    )
    preview = generation_service.preview(
        db_session,
        user_id=user.id,
        prompt="Plan the report\nPrepare the presentation",
        ai_service=_ai(
            {
                "tasks": [
                    {
                        "client_id": "task-1",
                        "title": "Plan report",
                        "priority": "high",
                        "due_date": None,
                    },
                    {
                        "client_id": "task-2",
                        "title": "Prepare presentation",
                        "priority": "medium",
                        "due_date": "2026-09-30",
                    },
                ]
            }
        ),
    )

    assert preview.metadata.source == "fake"
    assert len(preview.proposal.tasks) == 2
    assert preview.proposal.tasks[0].due_date == datetime.now(UTC).date()
    assert preview.proposal.tasks[1].priority == TaskPriority.MEDIUM


def test_confirmation_rejects_another_user_token(db_session, monkeypatch):
    owner = _user(db_session)
    another_user = _user(db_session)
    monkeypatch.setattr(
        generation_service,
        "get_settings",
        lambda: SimpleNamespace(ai_enabled=False),
    )
    preview = generation_service.preview(
        db_session,
        user_id=owner.id,
        prompt="Private task",
        ai_service=_ai(),
    )

    with pytest.raises(LookupError):
        generation_service.confirm(
            db_session,
            user_id=another_user.id,
            payload=TaskGenerationConfirmRequest(
                proposal_token=preview.proposal.proposal_token,
                tasks=preview.proposal.tasks,
            ),
        )
    assert (
        db_session.scalar(
            select(func.count()).select_from(Task).where(Task.user_id == another_user.id)
        )
        == 0
    )


def test_generated_task_schema_rejects_unknown_fields_and_oversized_batches():
    with pytest.raises(ValidationError):
        GeneratedTaskDraft.model_validate(
            {
                "client_id": "task-1",
                "title": "Task",
                "priority": "low",
                "due_date": "2026-09-20",
                "status": "done",
            }
        )


def test_generation_endpoints_require_confirmation_before_writing(client, db_session):
    email = f"generated-api-{uuid.uuid4()}@example.com"
    password = "TestPassword123"
    register = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Task",
            "last_name": "Generator",
            "role": "student",
        },
    )
    assert register.status_code == 201
    login = client.post("/auth/login", json={"email": email, "password": password})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    user_id = uuid.UUID(register.json()["id"])

    preview = client.post(
        "/tasks/generate/preview",
        headers=headers,
        json={"prompt": "Write report today; Review slides tomorrow"},
    )
    assert preview.status_code == 200
    payload = preview.json()
    assert payload["status"] == "preview"
    assert payload["requires_confirmation"] is True
    assert (
        db_session.scalar(select(func.count()).select_from(Task).where(Task.user_id == user_id))
        == 0
    )

    confirmation = client.post(
        "/tasks/generate/confirm",
        headers=headers,
        json={
            "proposal_token": payload["proposal"]["proposal_token"],
            "tasks": payload["proposal"]["tasks"],
        },
    )
    assert confirmation.status_code == 200
    assert len(confirmation.json()["created"]) == 2
    assert all(task["status"] == "pending" for task in confirmation.json()["created"])
