import uuid

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    email = f"project-test-{uuid.uuid4()}@example.com"
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

    access_token = login_response.json()["access_token"]

    return {
        "Authorization": f"Bearer {access_token}",
    }


def test_create_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/projects",
        headers=auth_headers,
        json={
            "name": "University",
            "color": "#2563EB",
        },
    )

    assert response.status_code == 201

    project = response.json()

    assert project["name"] == "University"
    assert project["color"] == "#2563EB"
    assert project["id"]
    assert project["user_id"]
    assert project["created_at"]
    assert project["updated_at"]


def test_create_project_uses_default_color(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/projects",
        headers=auth_headers,
        json={"name": "Personal"},
    )

    assert response.status_code == 201
    assert response.json()["color"] == "#6366F1"


def test_list_projects(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    client.post(
        "/projects",
        headers=auth_headers,
        json={"name": "First Project"},
    )
    client.post(
        "/projects",
        headers=auth_headers,
        json={"name": "Second Project"},
    )

    response = client.get(
        "/projects",
        headers=auth_headers,
    )

    assert response.status_code == 200

    projects = response.json()

    assert len(projects) == 2
    assert {project["name"] for project in projects} == {
        "First Project",
        "Second Project",
    }
    assert all(project["task_count"] == 0 for project in projects)
    assert all(project["completed_task_count"] == 0 for project in projects)


def test_list_projects_includes_task_counts(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    project_response = client.post(
        "/projects",
        headers=auth_headers,
        json={"name": "Counted Project"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    first_task = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Pending task",
            "project_id": project_id,
        },
    )
    done_task = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Done task",
            "project_id": project_id,
        },
    )
    unassigned_task = client.post(
        "/tasks",
        headers=auth_headers,
        json={"title": "Unassigned task"},
    )

    assert first_task.status_code == 201
    assert done_task.status_code == 201
    assert unassigned_task.status_code == 201

    done_response = client.patch(
        f"/tasks/{done_task.json()['id']}",
        headers=auth_headers,
        json={"status": "done"},
    )
    assert done_response.status_code == 200

    response = client.get(
        "/projects",
        headers=auth_headers,
    )

    assert response.status_code == 200

    project = response.json()[0]
    assert project["id"] == project_id
    assert project["task_count"] == 2
    assert project["completed_task_count"] == 1


def test_update_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    create_response = client.post(
        "/projects",
        headers=auth_headers,
        json={"name": "Old Name"},
    )
    project_id = create_response.json()["id"]

    response = client.patch(
        f"/projects/{project_id}",
        headers=auth_headers,
        json={
            "name": "New Name",
            "color": "#10B981",
        },
    )

    assert response.status_code == 200
    assert response.json()["name"] == "New Name"
    assert response.json()["color"] == "#10B981"


def test_update_missing_project_returns_404(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.patch(
        f"/projects/{uuid.uuid4()}",
        headers=auth_headers,
        json={"name": "New Name"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_delete_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    create_response = client.post(
        "/projects",
        headers=auth_headers,
        json={"name": "Temporary Project"},
    )
    project_id = create_response.json()["id"]

    delete_response = client.delete(
        f"/projects/{project_id}",
        headers=auth_headers,
    )

    assert delete_response.status_code == 204
    assert delete_response.content == b""

    list_response = client.get(
        "/projects",
        headers=auth_headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == []


def test_projects_require_authentication(
    client: TestClient,
) -> None:
    list_response = client.get("/projects")
    create_response = client.post(
        "/projects",
        json={"name": "Unauthorised Project"},
    )

    assert list_response.status_code in {401, 403}
    assert create_response.status_code in {401, 403}
