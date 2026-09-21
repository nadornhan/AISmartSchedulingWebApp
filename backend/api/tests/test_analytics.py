import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.focus.models import FocusSession, FocusSessionStatus
from app.tasks.models import Task, TaskStatus
from app.timezones import user_timezone


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
    assert payload["completion_rate_this_week"] == 0
    assert payload["unfinished_workload_minutes_this_week"] == 0
    assert payload["focus_duration_minutes_this_week"] == 0
    assert payload["goal_progress_percent"] == 0
    assert payload["current_streak_days"] == 0
    assert len(payload["trend"]) == 7
    assert len(payload["recommendations"]) == 3
    assert payload["recommendations"][0]["category"] == "deep_focus"


def test_current_week_uses_browser_timezone_for_default_utc_settings(client: TestClient) -> None:
    headers, _user_id = create_auth_headers(client)

    response = client.get(
        "/analytics/insights",
        headers={**headers, "X-Client-Timezone": "Australia/Sydney"},
    )

    assert response.status_code == 200
    payload = response.json()
    timezone = user_timezone("Australia/Sydney")
    period_start = datetime.fromisoformat(payload["period_start"]).astimezone(timezone)
    period_end = datetime.fromisoformat(payload["period_end"]).astimezone(timezone)
    assert payload["timezone"] == "Australia/Sydney"
    assert period_start.weekday() == 0
    assert period_start.time() == datetime.min.time()
    assert period_end.time() == datetime.min.time()
    assert period_end.date() - period_start.date() == timedelta(days=7)


def test_insights_counts_completed_tasks_this_week(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, user_id = create_auth_headers(client)

    now = datetime.now(UTC)
    for index in range(3):
        task = Task(
            user_id=uuid.UUID(user_id),
            title=f"Done {index}",
            status=TaskStatus.DONE,
            estimated_duration_minutes=30,
            completed_at=now - timedelta(hours=index + 1),
            updated_at=now - timedelta(hours=index + 1),
            created_at=now - timedelta(days=1),
        )
        db_session.add(task)

    older = Task(
        user_id=uuid.UUID(user_id),
        title="Old done",
        status=TaskStatus.DONE,
        estimated_duration_minutes=60,
        completed_at=now - timedelta(days=10),
        updated_at=now - timedelta(days=10),
        created_at=now - timedelta(days=11),
    )
    db_session.add(older)
    db_session.commit()

    response = client.get("/analytics/insights", headers=headers)
    assert response.status_code == 200

    payload = response.json()
    assert payload["tasks_completed_this_week"] == 3
    assert payload["completion_rate_this_week"] == 1
    assert payload["unfinished_workload_minutes_this_week"] == 0
    assert payload["estimated_work_minutes_this_week"] == 90
    assert payload["estimated_work_time_label"] == "1h 30m"
    assert payload["current_streak_days"] >= 1
    assert any(point["completed_count"] > 0 for point in payload["trend"])


def test_current_week_focus_duration_counts_stopped_sessions(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, user_id = create_auth_headers(client)
    now = datetime.now(UTC)
    db_session.add(
        FocusSession(
            user_id=uuid.UUID(user_id),
            started_at=now - timedelta(minutes=3),
            ended_at=now - timedelta(minutes=1),
            duration_minutes=2,
            planned_duration_minutes=25,
            actual_duration_seconds=120,
            status=FocusSessionStatus.CANCELLED.value,
            completed=False,
        )
    )
    db_session.commit()

    response = client.get("/analytics/insights", headers=headers)

    assert response.status_code == 200
    assert response.json()["focus_duration_minutes_this_week"] == 2
