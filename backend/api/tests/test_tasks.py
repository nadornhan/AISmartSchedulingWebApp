import uuid

import pytest
from fastapi.testclient import TestClient


def create_auth_headers(
    client: TestClient,
    email_prefix: str = "task-test",
) -> dict[str, str]:
    email = f"{email_prefix}-{uuid.uuid4()}@example.com"
    password = "TestPassword123"

    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
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
        "Authorization": (f"Bearer {login_response.json()['access_token']}"),
    }


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    return create_auth_headers(client)


def create_project(
    client: TestClient,
    auth_headers: dict[str, str],
    name: str = "Test Project",
) -> dict:
    response = client.post(
        "/projects",
        headers=auth_headers,
        json={"name": name},
    )

    assert response.status_code == 201
    return response.json()


def create_task(
    client: TestClient,
    auth_headers: dict[str, str],
    title: str,
    project_id: str | None = None,
) -> dict:
    payload = {
        "title": title,
        "description": "Task description",
    }

    if project_id is not None:
        payload["project_id"] = project_id

    response = client.post(
        "/tasks",
        headers=auth_headers,
        json=payload,
    )

    assert response.status_code == 201
    return response.json()


def test_create_task_with_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    project = create_project(client, auth_headers)

    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Complete assignment",
            "description": "Finish the backend tests",
            "project_id": project["id"],
        },
    )

    assert response.status_code == 201

    task = response.json()

    assert task["title"] == "Complete assignment"
    assert task["description"] == "Finish the backend tests"
    assert task["project_id"] == project["id"]
    assert task["status"] == "active"
    assert task["id"]
    assert task["user_id"]


def test_filter_tasks_by_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    first_project = create_project(
        client,
        auth_headers,
        "First Project",
    )
    second_project = create_project(
        client,
        auth_headers,
        "Second Project",
    )

    create_task(
        client,
        auth_headers,
        "First project task",
        first_project["id"],
    )
    create_task(
        client,
        auth_headers,
        "Second project task",
        second_project["id"],
    )
    create_task(
        client,
        auth_headers,
        "Task without project",
    )

    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={"project_id": first_project["id"]},
    )

    assert response.status_code == 200

    tasks = response.json()

    assert len(tasks) == 1
    assert tasks[0]["title"] == "First project task"
    assert tasks[0]["project_id"] == first_project["id"]


def test_update_task_to_another_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    first_project = create_project(
        client,
        auth_headers,
        "Original Project",
    )
    second_project = create_project(
        client,
        auth_headers,
        "New Project",
    )
    task = create_task(
        client,
        auth_headers,
        "Move this task",
        first_project["id"],
    )

    response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"project_id": second_project["id"]},
    )

    assert response.status_code == 200
    assert response.json()["project_id"] == second_project["id"]


def test_remove_task_from_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    project = create_project(client, auth_headers)
    task = create_task(
        client,
        auth_headers,
        "Remove from project",
        project["id"],
    )

    response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"project_id": None},
    )

    assert response.status_code == 200
    assert response.json()["project_id"] is None


def test_cannot_use_another_users_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    other_user_headers = create_auth_headers(
        client,
        "other-user",
    )
    other_project = create_project(
        client,
        other_user_headers,
        "Other User Project",
    )

    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Unauthorised task",
            "project_id": other_project["id"],
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_deleting_project_sets_task_project_id_to_null(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    project = create_project(client, auth_headers)
    task = create_task(
        client,
        auth_headers,
        "Keep after project deletion",
        project["id"],
    )

    delete_response = client.delete(
        f"/projects/{project['id']}",
        headers=auth_headers,
    )

    assert delete_response.status_code == 204

    list_response = client.get(
        "/tasks",
        headers=auth_headers,
    )

    assert list_response.status_code == 200

    matching_tasks = [item for item in list_response.json() if item["id"] == task["id"]]

    assert len(matching_tasks) == 1
    assert matching_tasks[0]["project_id"] is None
