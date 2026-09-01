import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai import get_ai_service
from app.ai.exceptions import (
    AIAuthenticationError,
    AIInvalidResponseError,
    AIModelUnavailableError,
    AIQuotaError,
    AIRequestLimitError,
    AITimeoutError,
    AIUpstreamError,
)
from app.ai.fake import FakeAIProvider
from app.ai.limiter import AIRequestLimiter
from app.ai.service import AIService
from app.main import app
from app.scheduling.models import AiRecommendation, AiScheduleSuggestion
from app.tasks.models import Task


def auth_headers(client: TestClient, prefix: str = "gemini") -> dict[str, str]:
    email = f"{prefix}-{uuid.uuid4()}@example.com"
    password = "TestPassword123"
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Gemini",
            "last_name": "Tester",
            "role": "student",
        },
    )
    assert response.status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_task(
    client: TestClient,
    headers: dict[str, str],
    *,
    title: str = "Gemini task",
    duration: int = 30,
    due_date: str = "2099-01-01T17:00:00+00:00",
    scheduled_start: str | None = None,
    scheduled_end: str | None = None,
) -> dict:
    payload = {
        "title": title,
        "priority": "high",
        "due_date": due_date,
        "estimated_duration_minutes": duration,
    }
    if scheduled_start is not None:
        payload["scheduled_start"] = scheduled_start
    if scheduled_end is not None:
        payload["scheduled_end"] = scheduled_end

    response = client.post("/tasks", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


class FailingAIProvider:
    def __init__(self, error: Exception) -> None:
        self.error = error
        self.calls = []

    def generate_structured(self, **kwargs):
        self.calls.append(kwargs)
        raise self.error


@pytest.fixture
def fake_ai_service():
    providers: list[FakeAIProvider | FailingAIProvider] = []

    def install(
        result=None,
        error: Exception | None = None,
    ) -> FakeAIProvider | FailingAIProvider:
        provider: FakeAIProvider | FailingAIProvider
        if error is None:
            provider = FakeAIProvider([result])
        else:
            provider = FailingAIProvider(error)
        providers.append(provider)
        app.dependency_overrides[get_ai_service] = lambda: AIService(
            provider,
            AIRequestLimiter(100),
        )
        return provider

    return install


def slot(
    task_id: str,
    start: str = "2099-01-01T09:00:00+00:00",
    end: str = "2099-01-01T09:30:00+00:00",
) -> dict[str, str]:
    return {
        "task_id": task_id,
        "suggested_start": start,
        "suggested_end": end,
        "explanation": "Fits the configured work window.",
    }


def recommendation_count(db_session: Session) -> int:
    return db_session.scalar(select(func.count()).select_from(AiRecommendation)) or 0


def suggestion_count(db_session: Session) -> int:
    return db_session.scalar(select(func.count()).select_from(AiScheduleSuggestion)) or 0


def test_ai_preview_returns_structured_preview_without_database_write(
    client: TestClient,
    db_session: Session,
    fake_ai_service,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = auth_headers(client)
    task = create_task(client, headers, title="Preview me")
    before_recommendations = recommendation_count(db_session)
    before_suggestions = suggestion_count(db_session)

    def fail_database_write(*_args, **_kwargs) -> None:
        pytest.fail("ai-preview must not write to the database")

    monkeypatch.setattr(db_session, "add", fail_database_write)
    monkeypatch.setattr(db_session, "commit", fail_database_write)

    fake = fake_ai_service({"schedule": [slot(task["id"])]})
    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [task["id"]]},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["model"] == "fake"
    assert body["schedule"][0]["task_id"] == task["id"]
    assert body["schedule"][0]["task_title"] == "Preview me"
    assert len(fake.calls) == 1
    assert "GEMINI_API_KEY" not in fake.calls[0]["prompt"]
    assert "user_id" not in fake.calls[0]["prompt"]
    assert fake.calls[0]["feature"] == "schedule_preview"
    assert fake.calls[0]["prompt_version"] == "schedule-preview-v1"
    assert recommendation_count(db_session) == before_recommendations
    assert suggestion_count(db_session) == before_suggestions

    unchanged = db_session.get(Task, uuid.UUID(task["id"]))
    assert unchanged is not None
    assert unchanged.scheduled_start is None
    assert unchanged.scheduled_end is None


@pytest.mark.parametrize(
    ("payload", "expected_status"),
    [
        ({"task_ids": []}, 422),
        ({"task_ids": [str(uuid.uuid4()) for _ in range(11)]}, 422),
    ],
)
def test_ai_preview_rejects_invalid_task_id_lists(
    client: TestClient,
    payload: dict,
    expected_status: int,
) -> None:
    response = client.post(
        "/scheduling/ai-preview",
        headers=auth_headers(client),
        json=payload,
    )

    assert response.status_code == expected_status


def test_ai_preview_rejects_duplicate_task_ids(client: TestClient) -> None:
    headers = auth_headers(client)
    task = create_task(client, headers)

    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [task["id"], task["id"]]},
    )

    assert response.status_code == 422


def test_ai_preview_returns_404_for_unknown_task_id(client: TestClient, fake_ai_service) -> None:
    headers = auth_headers(client)
    fake_ai_service({"schedule": []})

    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [str(uuid.uuid4())]},
    )

    assert response.status_code == 404


def test_ai_preview_returns_404_for_task_owned_by_another_user(
    client: TestClient,
    fake_ai_service,
) -> None:
    owner_headers = auth_headers(client, "owner")
    requester_headers = auth_headers(client, "requester")
    task = create_task(client, owner_headers)
    fake_ai_service({"schedule": [slot(task["id"])]})

    response = client.post(
        "/scheduling/ai-preview",
        headers=requester_headers,
        json={"task_ids": [task["id"]]},
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        (AIAuthenticationError("secret-key-leak-check"), 502),
        (AIModelUnavailableError("model raw response"), 502),
        (AITimeoutError("timeout raw response"), 504),
        (AIQuotaError("quota raw response"), 429),
        (AIRequestLimitError("rate raw response"), 429),
        (AIUpstreamError("upstream raw response"), 502),
        (AIInvalidResponseError("malformed raw response"), 502),
    ],
)
def test_ai_preview_maps_gemini_errors_to_sanitized_responses(
    client: TestClient,
    fake_ai_service,
    error: Exception,
    expected_status: int,
) -> None:
    headers = auth_headers(client)
    task = create_task(client, headers)
    fake_ai_service(error=error)

    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [task["id"]]},
    )

    assert response.status_code == expected_status
    assert "secret-key-leak-check" not in response.text
    assert "raw response" not in response.text


def test_ai_preview_missing_api_key_returns_503(client: TestClient) -> None:
    headers = auth_headers(client)
    task = create_task(client, headers)

    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [task["id"]]},
    )

    assert response.status_code == 503
    assert "GEMINI_API_KEY" not in response.text


@pytest.mark.parametrize(
    "result",
    [
        "not-json",
        {"schedule": [{"task_id": str(uuid.uuid4())}]},
    ],
)
def test_ai_preview_rejects_malformed_structured_output(
    client: TestClient,
    fake_ai_service,
    result: object,
) -> None:
    headers = auth_headers(client)
    task = create_task(client, headers)
    fake_ai_service(result)

    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [task["id"]]},
    )

    assert response.status_code == 502


@pytest.mark.parametrize(
    "bad_slot",
    [
        lambda task_id: slot(task_id, end="2099-01-01T08:30:00+00:00"),
        lambda task_id: slot(
            task_id,
            start="2099-01-01T08:00:00+00:00",
            end="2099-01-01T08:30:00+00:00",
        ),
        lambda task_id: slot(
            task_id,
            start="2099-01-01T09:00:00+00:00",
            end="2099-01-01T09:45:00+00:00",
        ),
        lambda task_id: slot(
            task_id,
            start="2099-01-01T16:45:00+00:00",
            end="2099-01-01T17:15:00+00:00",
        ),
        lambda task_id: slot(
            task_id,
            start="2099-01-01T16:31:00+00:00",
            end="2099-01-01T17:01:00+00:00",
        ),
        lambda _task_id: slot(str(uuid.uuid4())),
    ],
)
def test_ai_preview_rejects_deterministic_validation_failures(
    client: TestClient,
    fake_ai_service,
    bad_slot,
) -> None:
    headers = auth_headers(client)
    task = create_task(client, headers)
    fake_ai_service({"schedule": [bad_slot(task["id"])]})

    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [task["id"]]},
    )

    assert response.status_code == 502


def test_ai_preview_rejects_overlapping_suggestions(
    client: TestClient,
    fake_ai_service,
) -> None:
    headers = auth_headers(client)
    first = create_task(client, headers, title="First")
    second = create_task(client, headers, title="Second")
    fake_ai_service(
        {
            "schedule": [
                slot(
                    first["id"], start="2099-01-01T09:00:00+00:00", end="2099-01-01T09:30:00+00:00"
                ),
                slot(
                    second["id"],
                    start="2099-01-01T09:15:00+00:00",
                    end="2099-01-01T09:45:00+00:00",
                ),
            ]
        }
    )

    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [first["id"], second["id"]]},
    )

    assert response.status_code == 502


def test_ai_preview_rejects_conflict_with_existing_scheduled_task(
    client: TestClient,
    fake_ai_service,
) -> None:
    headers = auth_headers(client)
    create_task(
        client,
        headers,
        title="Already scheduled",
        scheduled_start="2099-01-01T09:00:00+00:00",
        scheduled_end="2099-01-01T09:30:00+00:00",
    )
    task = create_task(client, headers, title="Requested")
    fake_ai_service({"schedule": [slot(task["id"])]})

    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [task["id"]]},
    )

    assert response.status_code == 502


def test_ai_preview_rejects_completed_task(client: TestClient, fake_ai_service) -> None:
    headers = auth_headers(client)
    task = create_task(client, headers)
    complete = client.patch(f"/tasks/{task['id']}", headers=headers, json={"status": "done"})
    assert complete.status_code == 200
    fake_ai_service({"schedule": [slot(task["id"])]})

    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [task["id"]]},
    )

    assert response.status_code == 502


def test_ai_preview_rejects_deadline_violation(client: TestClient, fake_ai_service) -> None:
    headers = auth_headers(client)
    task = create_task(
        client,
        headers,
        due_date=(datetime(2099, 1, 1, 9, 15, tzinfo=UTC)).isoformat(),
    )
    fake_ai_service({"schedule": [slot(task["id"])]})

    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [task["id"]]},
    )

    assert response.status_code == 502


def test_ai_preview_uses_current_slot_duration_clamp(
    client: TestClient,
    fake_ai_service,
) -> None:
    headers = auth_headers(client)
    short_task = create_task(client, headers, duration=5)
    long_task = create_task(client, headers, title="Long", duration=180)
    fake_ai_service(
        {
            "schedule": [
                slot(
                    short_task["id"],
                    start="2099-01-01T09:00:00+00:00",
                    end="2099-01-01T09:15:00+00:00",
                ),
                slot(
                    long_task["id"],
                    start="2099-01-01T09:20:00+00:00",
                    end="2099-01-01T11:20:00+00:00",
                ),
            ]
        }
    )

    response = client.post(
        "/scheduling/ai-preview",
        headers=headers,
        json={"task_ids": [short_task["id"], long_task["id"]]},
    )

    assert response.status_code == 200, response.text
