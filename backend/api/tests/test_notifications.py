import uuid
from datetime import UTC, datetime, timedelta

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
    due_date: str | None = None,
) -> dict:
    payload = {"title": title, "priority": "high"}
    if project_id is not None:
        payload["project_id"] = project_id
    if due_date is not None:
        payload["due_date"] = due_date

    response = client.post(
        "/tasks",
        headers=auth_headers,
        json=payload,
    )
    assert response.status_code == 201
    return response.json()


def patch_settings(
    client: TestClient,
    auth_headers: dict[str, str],
    payload: dict,
) -> dict:
    response = client.patch(
        "/settings",
        headers=auth_headers,
        json=payload,
    )
    assert response.status_code == 200
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
    assert notification["type"] == "task_created"
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


def test_upcoming_deadline_reminder_created_once(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)
    due_date = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    task = create_task(
        client,
        auth_headers,
        "Soon due task",
        due_date=due_date,
    )

    first_response = client.get(
        "/notifications",
        headers=auth_headers,
        params={"limit": 10},
    )
    second_response = client.get(
        "/notifications",
        headers=auth_headers,
        params={"limit": 10},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200

    notifications = second_response.json()["items"]
    reminders = [
        notification
        for notification in notifications
        if notification["type"] == "task_reminder"
    ]

    assert len(reminders) == 1
    assert reminders[0]["task_id"] == task["id"]
    assert reminders[0]["dedupe_key"] == f"task_reminder:{task['id']}"
    assert reminders[0]["scheduled_for"] is not None


def test_task_reminder_respects_settings_preference(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)
    patch_settings(
        client,
        auth_headers,
        {
            "notifications": {
                "notify_task_reminders": False,
            },
        },
    )
    create_task(
        client,
        auth_headers,
        "Muted reminder task",
        due_date=(datetime.now(UTC) + timedelta(hours=2)).isoformat(),
    )

    response = client.get(
        "/notifications",
        headers=auth_headers,
        params={"limit": 10},
    )

    assert response.status_code == 200
    assert all(
        notification["type"] != "task_reminder"
        for notification in response.json()["items"]
    )


def test_overdue_alert_respects_settings_preference(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)
    patch_settings(
        client,
        auth_headers,
        {
            "notifications": {
                "notify_overdue_alerts": False,
            },
        },
    )
    create_task(
        client,
        auth_headers,
        "Muted overdue task",
        due_date=(datetime.now(UTC) - timedelta(hours=2)).isoformat(),
    )

    muted_response = client.get(
        "/notifications",
        headers=auth_headers,
        params={"limit": 10},
    )

    assert muted_response.status_code == 200
    assert all(
        notification["type"] != "overdue_alert"
        for notification in muted_response.json()["items"]
    )

    patch_settings(
        client,
        auth_headers,
        {
            "notifications": {
                "notify_overdue_alerts": True,
            },
        },
    )
    enabled_response = client.get(
        "/notifications",
        headers=auth_headers,
        params={"limit": 10},
    )

    assert enabled_response.status_code == 200
    assert any(
        notification["type"] == "overdue_alert"
        for notification in enabled_response.json()["items"]
    )


def test_productivity_message_respects_settings_preference(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)
    patch_settings(
        client,
        auth_headers,
        {
            "notifications": {
                "notify_productivity_reminders": False,
            },
        },
    )

    muted_response = client.get(
        "/notifications",
        headers=auth_headers,
        params={"limit": 10},
    )

    assert muted_response.status_code == 200
    assert all(
        notification["type"] != "productivity_reminder"
        for notification in muted_response.json()["items"]
    )

    patch_settings(
        client,
        auth_headers,
        {
            "notifications": {
                "notify_productivity_reminders": True,
            },
        },
    )
    enabled_response = client.get(
        "/notifications",
        headers=auth_headers,
        params={"limit": 10},
    )

    assert enabled_response.status_code == 200
    assert any(
        notification["type"] == "productivity_reminder"
        for notification in enabled_response.json()["items"]
    )


def test_mark_all_notifications_read_only_marks_current_user(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)
    other_headers = create_auth_headers(client, "other-mark-all-test")

    create_task(client, auth_headers, "Own unread task")
    create_task(client, other_headers, "Other unread task")

    response = client.post(
        "/notifications/mark-all-read",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["unread_count"] == 0

    other_response = client.get(
        "/notifications",
        headers=other_headers,
    )

    assert other_response.status_code == 200
    assert other_response.json()["unread_count"] == 1


def test_notifications_require_authentication(
    client: TestClient,
) -> None:
    list_response = client.get("/notifications")
    mark_response = client.post(
        "/notifications/mark-read",
        json=[],
    )
    mark_all_response = client.post("/notifications/mark-all-read")

    assert list_response.status_code in {401, 403}
    assert mark_response.status_code in {401, 403}
    assert mark_all_response.status_code in {401, 403}
