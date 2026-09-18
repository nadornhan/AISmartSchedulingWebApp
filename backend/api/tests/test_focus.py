import uuid

from fastapi.testclient import TestClient


def _auth_headers(client: TestClient, prefix: str = "focus") -> dict[str, str]:
    email = f"{prefix}-{uuid.uuid4()}@example.com"
    password = "TestPassword123"
    registered = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Focus",
            "last_name": "Tester",
        },
    )
    assert registered.status_code == 201
    logged_in = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert logged_in.status_code == 200
    return {"Authorization": f"Bearer {logged_in.json()['access_token']}"}


def _create_task(client: TestClient, headers: dict[str, str], title: str) -> str:
    response = client.post("/tasks", headers=headers, json={"title": title})
    assert response.status_code == 201
    return response.json()["id"]


def test_focus_session_supports_multiple_tasks_and_stop(client: TestClient) -> None:
    headers = _auth_headers(client)
    first_task_id = _create_task(client, headers, "Draft focus report")
    second_task_id = _create_task(client, headers, "Review focus report")

    started = client.post(
        "/focus/sessions/start",
        headers=headers,
        json={
            "task_ids": [first_task_id, second_task_id],
            "planned_duration_minutes": 25,
        },
    )

    assert started.status_code == 201
    session = started.json()
    assert session["task_id"] == first_task_id
    assert set(session["task_ids"]) == {first_task_id, second_task_id}
    assert session["status"] == "active"

    stopped = client.post(
        f"/focus/sessions/{session['id']}/cancel",
        headers=headers,
        json={"actual_duration_seconds": 45},
    )

    assert stopped.status_code == 200
    assert stopped.json()["status"] == "cancelled"
    assert stopped.json()["actual_duration_seconds"] == 45
    assert set(stopped.json()["task_ids"]) == {first_task_id, second_task_id}
    assert client.get("/focus/sessions/active", headers=headers).json() is None


def test_legacy_task_id_is_included_in_task_ids(client: TestClient) -> None:
    headers = _auth_headers(client, "focus-legacy")
    task_id = _create_task(client, headers, "Legacy focus task")

    started = client.post(
        "/focus/sessions/start",
        headers=headers,
        json={"task_id": task_id, "planned_duration_minutes": 20},
    )

    assert started.status_code == 201
    assert started.json()["task_id"] == task_id
    assert started.json()["task_ids"] == [task_id]


def test_focus_session_rejects_another_users_task(client: TestClient) -> None:
    owner_headers = _auth_headers(client, "focus-owner")
    other_headers = _auth_headers(client, "focus-other")
    task_id = _create_task(client, owner_headers, "Private focus task")

    response = client.post(
        "/focus/sessions/start",
        headers=other_headers,
        json={"task_ids": [task_id], "planned_duration_minutes": 25},
    )

    assert response.status_code == 404
