import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.tasks.models import Task, TaskStatus


def create_auth_headers(client: TestClient) -> tuple[dict[str, str], str]:
    email = f"insights-{uuid.uuid4()}@example.com"
    password = "TestPassword123"

    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Alex",
            "last_name": "Insights",
            "role": "student",
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )
    assert login_response.status_code == 200

    return {
        "Authorization": f"Bearer {login_response.json()['access_token']}",
    }, register_response.json()["id"]


def test_insights_requires_auth(client: TestClient) -> None:
    response = client.get("/analytics/insights")
    assert response.status_code == 401


def test_insights_summary_for_new_user(client: TestClient) -> None:
    headers, _user_id = create_auth_headers(client)

    response = client.get("/analytics/insights", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_first_name"] == "Alex"
    assert payload["greeting"] == "You're doing great, Alex!"
    assert payload["tasks_completed_this_week"] == 0
    assert payload["goal_progress_percent"] == 0
    assert payload["current_streak_days"] == 0
    assert len(payload["trend"]) == 7
    assert len(payload["recommendations"]) == 3
    assert payload["recommendations"][0]["category"] == "deep_focus"


def test_insights_counts_completed_tasks_this_week(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, user_id = create_auth_headers(client)

    now = datetime.now(timezone.utc)
    for index in range(3):
        task = Task(
            user_id=uuid.UUID(user_id),
            title=f"Done {index}",
            status=TaskStatus.DONE,
            estimated_duration=30,
            updated_at=now - timedelta(hours=index + 1),
            created_at=now - timedelta(days=1),
        )
        db_session.add(task)

    older = Task(
        user_id=uuid.UUID(user_id),
        title="Old done",
        status=TaskStatus.DONE,
        estimated_duration=60,
        updated_at=now - timedelta(days=10),
        created_at=now - timedelta(days=11),
    )
    db_session.add(older)
    db_session.commit()

    response = client.get("/analytics/insights", headers=headers)
    assert response.status_code == 200

    payload = response.json()
    assert payload["tasks_completed_this_week"] == 3
    assert payload["focus_minutes_this_week"] == 90
    assert payload["focus_time_label"] == "1h 30m"
    assert payload["current_streak_days"] >= 1
    assert any(point["completed_count"] > 0 for point in payload["trend"])
