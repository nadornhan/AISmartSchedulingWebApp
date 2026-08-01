import uuid

from fastapi.testclient import TestClient


def create_auth_headers(
    client: TestClient,
    email_prefix: str = "notification-test",
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


def create_project(
    client: TestClient,
    auth_headers: dict[str, str],
    name: str = "Notification Project",
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
    payload = {"title": title, "priority": "high"}
    if project_id is not None:
        payload["project_id"] = project_id

    response = client.post(
        "/tasks",
        headers=auth_headers,
        json=payload,
    )
    assert response.status_code == 201
    return response.json()


def test_task_creation_creates_unread_notification(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)
    project = create_project(client, auth_headers)
    task = create_task(
        client,
        auth_headers,
        "Write notification tests",
        project["id"],
    )

    response = client.get(
        "/notifications",
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()
    notification = data["items"][0]

    assert data["unread_count"] == 1
    assert notification["is_read"] is False
    assert notification["title"] == "Task created"
    assert notification["message"] == "Write notification tests"
    assert notification["task_id"] == task["id"]
    assert notification["task"]["id"] == task["id"]
    assert notification["task"]["project_id"] == project["id"]
    assert notification["task"]["project_name"] == project["name"]
    assert notification["task"]["priority"] == "high"


def test_notifications_are_newest_first_and_limited(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)

    for index in range(6):
        create_task(
            client,
            auth_headers,
            f"Task {index}",
        )

    response = client.get(
        "/notifications",
        headers=auth_headers,
        params={"limit": 5},
    )

    assert response.status_code == 200

    data = response.json()

    assert data["unread_count"] == 6
    assert len(data["items"]) == 5
    assert [item["message"] for item in data["items"]] == [
        "Task 5",
        "Task 4",
        "Task 3",
        "Task 2",
        "Task 1",
    ]


def test_mark_notifications_read_only_marks_current_user_notifications(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)
    other_headers = create_auth_headers(client, "other-notification-test")

    own_task = create_task(client, auth_headers, "Own task")
    other_task = create_task(client, other_headers, "Other task")

    own_notifications = client.get(
        "/notifications",
        headers=auth_headers,
    ).json()["items"]
    other_notifications = client.get(
        "/notifications",
        headers=other_headers,
    ).json()["items"]

    response = client.post(
        "/notifications/mark-read",
        headers=auth_headers,
        json=[
            own_notifications[0]["id"],
            other_notifications[0]["id"],
        ],
    )

    assert response.status_code == 200
    assert response.json()["unread_count"] == 0
    assert response.json()["items"][0]["task_id"] == own_task["id"]

    other_response = client.get(
        "/notifications",
        headers=other_headers,
    )

    assert other_response.status_code == 200
    assert other_response.json()["unread_count"] == 1
    assert other_response.json()["items"][0]["task_id"] == other_task["id"]


def test_notifications_require_authentication(
    client: TestClient,
) -> None:
    list_response = client.get("/notifications")
    mark_response = client.post(
        "/notifications/mark-read",
        json=[],
    )

    assert list_response.status_code in {401, 403}
    assert mark_response.status_code in {401, 403}
