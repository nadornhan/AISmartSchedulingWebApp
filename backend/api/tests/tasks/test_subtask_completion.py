import uuid

from fastapi.testclient import TestClient


def _auth_headers(client: TestClient) -> dict[str, str]:
    email = f"subtask-completion-{uuid.uuid4()}@example.com"
    password = "TestPassword123"
    register = client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    assert register.status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_subtask_completion_endpoint_rejects_unknown_subtask(client: TestClient) -> None:
    headers = _auth_headers(client)
    task = client.post(
        "/tasks",
        headers=headers,
        json={"title": "Parent task", "subtasks": [{"title": "Known step"}]},
    ).json()

    response = client.patch(
        f"/tasks/{task['id']}/subtasks/{uuid.uuid4()}",
        headers=headers,
        json={"is_completed": True},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Subtask not found"
