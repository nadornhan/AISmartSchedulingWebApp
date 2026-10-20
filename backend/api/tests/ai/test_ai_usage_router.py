import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.ai.schemas import AIUsageEvent, AIUsageMetadata
from app.ai.telemetry import persist_ai_usage_event


def create_auth_headers(client: TestClient) -> tuple[dict[str, str], str]:
    email = f"ai-usage-{uuid.uuid4()}@example.com"
    password = "TestPassword123"

    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Member",
            "last_name": "One",
            "role": "student",
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200

    return {
        "Authorization": f"Bearer {login_response.json()['access_token']}",
    }, register_response.json()["id"]


def test_ai_usage_summary_requires_auth(client: TestClient) -> None:
    response = client.get("/ai/usage-summary")

    assert response.status_code == 401


def test_ai_usage_summary_returns_current_user_metrics(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, user_id = create_auth_headers(client)
    now = datetime.now(UTC)

    persist_ai_usage_event(
        db_session,
        AIUsageEvent(
            user_key=user_id,
            feature="task_understanding",
            prompt_version="task-understanding-v1",
            outcome="success",
            source="fake",
            model="fake",
            latency_ms=24,
            usage=AIUsageMetadata(input_tokens=10, output_tokens=5, total_tokens=15),
            created_at=now,
        ),
    )
    db_session.flush()

    response = client.get("/ai/usage-summary", headers=headers)

    assert response.status_code == 200
    assert response.json() == [
        {
            "feature": "task_understanding",
            "request_count": 1,
            "success_count": 1,
            "fallback_count": 0,
            "failure_count": 0,
            "total_tokens": 15,
            "average_latency_ms": 24.0,
            "fallback_rate": 0.0,
            "failure_rate": 0.0,
            "estimated_cost_usd": 0.0,
            "acceptance_rate": None,
        }
    ]
