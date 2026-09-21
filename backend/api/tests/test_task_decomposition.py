import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.ai import get_ai_service
from app.ai.fake import FakeAIProvider
from app.ai.limiter import AIRequestLimiter
from app.ai.service import AIService
from app.auth.models import User
from app.main import app
from app.tasks import decomposition_service
from app.tasks.decomposition_schemas import (
    ConfirmedDecomposedTaskDraft,
    GeneratedSubtaskDraft,
    TaskDecompositionConfirmRequest,
)
from app.tasks.models import Subtask, Task, TaskPriority, TaskStatus


def _user(db_session):
    user = User(
        email=f"decomposition-{uuid.uuid4()}@example.com",
        password_hash="test",
    )
    db_session.add(user)
    db_session.flush()
    return user


def _response():
    return {
        "title": "Prepare final presentation",
        "priority": "high",
        "due_date": "2026-10-01",
        "subtasks": [
            {"client_id": "subtask-1", "title": "Gather source material"},
            {"client_id": "subtask-2", "title": "Draft the slide outline"},
            {"client_id": "subtask-3", "title": "Rehearse the presentation"},
        ],
    }


def _ai():
    return AIService(FakeAIProvider([_response()]), AIRequestLimiter(100))


def test_decomposition_preview_does_not_write_and_confirmation_creates_subtasks(
    db_session,
):
    user = _user(db_session)
    preview = decomposition_service.preview(
        db_session,
        user_id=user.id,
        prompt="Prepare my final presentation by October 1 with high priority",
        ai_service=_ai(),
    )

    assert preview.feature == "task_decomposition"
    assert preview.requires_confirmation is True
    assert preview.metadata.source == "fake"
    assert len(preview.proposal.subtasks) == 3
    assert (
        db_session.scalar(select(func.count()).select_from(Task).where(Task.user_id == user.id))
        == 0
    )

    selected = [preview.proposal.subtasks[0], preview.proposal.subtasks[2]]
    result = decomposition_service.confirm(
        db_session,
        user_id=user.id,
        payload=TaskDecompositionConfirmRequest(
            proposal_token=preview.proposal.proposal_token,
            task=ConfirmedDecomposedTaskDraft(
                title="Edited presentation plan",
                priority=preview.proposal.priority,
                due_date=preview.proposal.due_date,
                subtasks=selected,
            ),
        ),
    )

    assert result.created.title == "Edited presentation plan"
    assert result.created.status == TaskStatus.PENDING
    assert result.created.priority == TaskPriority.HIGH
    assert [subtask.title for subtask in result.created.subtasks] == [
        "Gather source material",
        "Rehearse the presentation",
    ]
    assert (
        db_session.scalar(
            select(func.count()).select_from(Subtask).join(Task).where(Task.user_id == user.id)
        )
        == 2
    )


def test_decomposition_confirmation_rejects_another_user_token(db_session):
    owner = _user(db_session)
    another_user = _user(db_session)
    preview = decomposition_service.preview(
        db_session,
        user_id=owner.id,
        prompt="Prepare final presentation",
        ai_service=_ai(),
    )

    with pytest.raises(LookupError):
        decomposition_service.confirm(
            db_session,
            user_id=another_user.id,
            payload=TaskDecompositionConfirmRequest(
                proposal_token=preview.proposal.proposal_token,
                task=ConfirmedDecomposedTaskDraft(
                    title=preview.proposal.title,
                    priority=preview.proposal.priority,
                    due_date=preview.proposal.due_date,
                    subtasks=preview.proposal.subtasks,
                ),
            ),
        )


def test_decomposition_confirmation_requires_a_selected_subtask():
    with pytest.raises(ValidationError):
        ConfirmedDecomposedTaskDraft.model_validate(
            {
                "title": "Prepare final presentation",
                "priority": "medium",
                "due_date": None,
                "subtasks": [],
            }
        )


def test_decomposition_endpoints_preview_then_confirm(client, db_session):
    email = f"decomposition-api-{uuid.uuid4()}@example.com"
    password = "TestPassword123"
    register = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Task",
            "last_name": "Breakdown",
            "role": "student",
        },
    )
    login = client.post("/auth/login", json={"email": email, "password": password})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    user_id = uuid.UUID(register.json()["id"])
    app.dependency_overrides[get_ai_service] = _ai

    preview = client.post(
        "/tasks/decompose/preview",
        headers=headers,
        json={"prompt": "Prepare final presentation"},
    )
    assert preview.status_code == 200
    payload = preview.json()
    assert payload["status"] == "preview"
    assert payload["requires_confirmation"] is True
    assert (
        db_session.scalar(select(func.count()).select_from(Task).where(Task.user_id == user_id))
        == 0
    )

    payload["proposal"]["subtasks"].pop(1)
    confirmation = client.post(
        "/tasks/decompose/confirm",
        headers=headers,
        json={
            "proposal_token": payload["proposal"]["proposal_token"],
            "task": {
                "title": payload["proposal"]["title"],
                "priority": payload["proposal"]["priority"],
                "due_date": payload["proposal"]["due_date"],
                "subtasks": payload["proposal"]["subtasks"],
            },
        },
    )
    assert confirmation.status_code == 200
    assert len(confirmation.json()["created"]["subtasks"]) == 2


def test_decomposition_uses_current_time_context(db_session):
    user = _user(db_session)
    preview = decomposition_service.preview(
        db_session,
        user_id=user.id,
        prompt="Prepare final presentation",
        ai_service=_ai(),
    )
    assert preview.generated_at <= datetime.now(UTC)
    assert preview.proposal.expires_at > preview.generated_at
    assert all(isinstance(subtask, GeneratedSubtaskDraft) for subtask in preview.proposal.subtasks)
