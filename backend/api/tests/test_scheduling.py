import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient


def auth_headers(client: TestClient) -> dict[str, str]:
    email = f"schedule-{uuid.uuid4()}@example.com"
    password = "TestPassword123"
    assert client.post(
        "/auth/register",
        json={"email": email, "password": password},
    ).status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_generate_plan_and_apply_schedule(client: TestClient) -> None:
    headers = auth_headers(client)
    due = (datetime.now(UTC) + timedelta(hours=6)).isoformat()
    create = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Ship scheduling",
            "priority": "high",
            "due_date": due,
            "estimated_duration_minutes": 30,
        },
    )
    assert create.status_code == 201

    plan = client.get("/scheduling/plan", headers=headers)
    assert plan.status_code == 200
    body = plan.json()
    assert body["recommendation"] is not None
    assert body["recommendation"]["task"]["title"] == "Ship scheduling"
    assert any("weight" in item.lower() for item in body["recommendation"]["based_on"])
    assert body["footnote"] == "AI based on your patterns"
    assert len(body["schedule"]) >= 1

    suggestion_id = body["schedule"][0]["id"]
    accept = client.post(
        f"/scheduling/suggestions/{suggestion_id}/accept",
        headers=headers,
    )
    assert accept.status_code == 200
    assert accept.json()["status"] == "accepted"

    applied = client.post(
        "/scheduling/suggestions/apply",
        headers=headers,
        json={"suggestion_ids": [suggestion_id]},
    )
    assert applied.status_code == 200

    task = client.get(f"/tasks/{create.json()['id']}", headers=headers)
    assert task.status_code == 200
    assert task.json()["scheduled_start"] is not None
    assert task.json()["scheduled_end"] is not None


def test_focus_session_and_regenerate(client: TestClient) -> None:
    headers = auth_headers(client)
    create = client.post(
        "/tasks",
        headers=headers,
        json={"title": "Focus capture", "priority": "medium"},
    )
    assert create.status_code == 201
    task_id = create.json()["id"]

    started = datetime.now(UTC) - timedelta(minutes=25)
    ended = datetime.now(UTC)
    session = client.post(
        "/scheduling/focus-sessions",
        headers=headers,
        json={
            "task_id": task_id,
            "started_at": started.isoformat(),
            "ended_at": ended.isoformat(),
            "duration_minutes": 25,
            "completed": True,
        },
    )
    assert session.status_code == 201

    regenerated = client.post("/scheduling/plan/regenerate", headers=headers)
    assert regenerated.status_code == 200
    assert regenerated.json()["recommendation"] is not None


def test_dashboard_includes_ai_recommendation(client: TestClient) -> None:
    headers = auth_headers(client)
    client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Dashboard AI card",
            "priority": "high",
            "estimated_duration_minutes": 20,
            "due_date": (datetime.now(UTC) + timedelta(hours=4)).isoformat(),
        },
    )

    response = client.get("/dashboard/summary", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["ai_recommendation"] is not None
    assert payload["ai_recommendation"]["footnote"] == "AI based on your patterns"
    assert payload["ai_recommendation"]["task"]["title"] == "Dashboard AI card"
    assert payload["next_best_task"] is not None


def test_recommendation_refreshes_after_task_and_settings_changes(
    client: TestClient,
) -> None:
    headers = auth_headers(client)
    due = (datetime.now(UTC) + timedelta(hours=5)).isoformat()

    first = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Finish first",
            "priority": "high",
            "due_date": due,
            "estimated_duration_minutes": 25,
        },
    )
    assert first.status_code == 201
    first_id = first.json()["id"]

    second = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Then second",
            "priority": "medium",
            "due_date": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
            "estimated_duration_minutes": 45,
        },
    )
    assert second.status_code == 201
    second_id = second.json()["id"]

    plan = client.get("/scheduling/plan", headers=headers)
    assert plan.status_code == 200
    assert plan.json()["recommendation"]["task"]["id"] == first_id
    first_recommendation_id = plan.json()["recommendation"]["id"]

    completed = client.patch(
        f"/tasks/{first_id}",
        headers=headers,
        json={"status": "done"},
    )
    assert completed.status_code == 200

    refreshed = client.get("/scheduling/plan", headers=headers)
    assert refreshed.status_code == 200
    assert refreshed.json()["recommendation"] is not None
    assert refreshed.json()["recommendation"]["task"]["id"] == second_id
    assert refreshed.json()["recommendation"]["id"] != first_recommendation_id

    updated_task = client.patch(
        f"/tasks/{second_id}",
        headers=headers,
        json={"title": "Then second (updated)", "priority": "high"},
    )
    assert updated_task.status_code == 200

    after_edit = client.get("/scheduling/plan", headers=headers)
    assert after_edit.status_code == 200
    assert after_edit.json()["recommendation"]["task"]["title"] == "Then second (updated)"
    assert after_edit.json()["recommendation"]["id"] != refreshed.json()["recommendation"]["id"]

    settings = client.patch(
        "/settings",
        headers=headers,
        json={
            "ai_scheduling": {
                "ai_deadline_urgency_weight": 90,
                "ai_priority_weight": 10,
                "ai_estimated_duration_weight": 10,
            }
        },
    )
    assert settings.status_code == 200

    after_weights = client.get("/scheduling/plan", headers=headers)
    assert after_weights.status_code == 200
    assert after_weights.json()["recommendation"] is not None
    assert (
        after_weights.json()["recommendation"]["weights"]["deadline_urgency"] == 90
    )
