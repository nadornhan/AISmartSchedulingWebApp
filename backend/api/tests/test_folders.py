import uuid

from fastapi.testclient import TestClient


def create_auth_headers(client: TestClient) -> dict[str, str]:
    email = f"folder-alias-{uuid.uuid4()}@example.com"
    password = "TestPassword123"

    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Folder",
            "last_name": "User",
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
    }


def test_folders_alias_create_list_and_delete(client: TestClient) -> None:
    headers = create_auth_headers(client)

    create_response = client.post(
        "/folders",
        headers=headers,
        json={"name": "Design Sprint", "color": "#35E3B5"},
    )
    assert create_response.status_code == 201
    folder = create_response.json()
    assert folder["name"] == "Design Sprint"
    assert folder["color"] == "#35E3B5"
    assert folder["task_count"] == 0
    assert folder["completed_task_count"] == 0

    list_response = client.get("/folders", headers=headers)
    assert list_response.status_code == 200
    folders = list_response.json()
    assert any(item["id"] == folder["id"] for item in folders)

    projects_response = client.get("/projects", headers=headers)
    assert projects_response.status_code == 200
    assert any(item["id"] == folder["id"] for item in projects_response.json())

    delete_response = client.delete(f"/folders/{folder['id']}", headers=headers)
    assert delete_response.status_code == 204


def test_create_project_returns_zero_counts(client: TestClient) -> None:
    headers = create_auth_headers(client)

    response = client.post(
        "/projects",
        headers=headers,
        json={"name": "Backend Project"},
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["task_count"] == 0
    assert payload["completed_task_count"] == 0
