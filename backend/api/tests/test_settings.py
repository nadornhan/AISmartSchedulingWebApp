import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.settings.models import UserSettings


def create_auth_headers(
    client: TestClient,
    email_prefix: str = "settings-test",
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
        "Authorization": f"Bearer {login_response.json()['access_token']}",
    }


def test_settings_require_authentication(client: TestClient) -> None:
    get_response = client.get("/settings")
    patch_response = client.patch(
        "/settings",
        json={
            "work_pattern": {
                "pomodoro_minutes": 30,
            },
        },
    )

    assert get_response.status_code in {401, 403}
    assert patch_response.status_code in {401, 403}


def test_get_settings_creates_default_settings(
    client: TestClient,
    db_session: Session,
) -> None:
    auth_headers = create_auth_headers(client)

    response = client.get("/settings", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()
    assert data["work_pattern"] == {
        "work_start": "09:00",
        "work_end": "17:00",
        "pomodoro_minutes": 25,
    }
    assert data["ai_scheduling"] == {
        "ai_assistant_enabled": True,
        "ai_deadline_urgency_weight": 80,
        "ai_priority_weight": 70,
        "ai_estimated_duration_weight": 50,
    }
    assert data["notifications"]["notify_task_reminders"] is True
    assert data["notifications"]["notify_weekly_report"] is False
    assert data["channels"] == {
        "channel_desktop": False,
        "channel_push": True,
        "channel_email": True,
    }

    settings_rows = list(
        db_session.scalars(
            select(UserSettings).where(UserSettings.user_id == uuid.UUID(data["user_id"]))
        ).all()
    )
    assert len(settings_rows) == 1
    assert str(settings_rows[0].user_id) == data["user_id"]


def test_patch_settings_partially_updates_without_overwriting_other_fields(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)
    original_response = client.get("/settings", headers=auth_headers)
    assert original_response.status_code == 200

    response = client.patch(
        "/settings",
        headers=auth_headers,
        json={
            "work_pattern": {
                "work_start": "08:30",
                "pomodoro_minutes": 45,
            },
            "ai_scheduling": {
                "ai_assistant_enabled": False,
                "ai_priority_weight": 25,
            },
            "notifications": {
                "notify_task_reminders": False,
                "notify_weekly_report": True,
            },
            "channels": {
                "channel_desktop": True,
            },
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["work_pattern"] == {
        "work_start": "08:30",
        "work_end": "17:00",
        "pomodoro_minutes": 45,
    }
    assert data["ai_scheduling"] == {
        "ai_assistant_enabled": False,
        "ai_deadline_urgency_weight": 80,
        "ai_priority_weight": 25,
        "ai_estimated_duration_weight": 50,
    }
    assert data["notifications"]["notify_task_reminders"] is False
    assert data["notifications"]["notify_productivity_reminders"] is True
    assert data["notifications"]["notify_weekly_report"] is True
    assert data["channels"] == {
        "channel_desktop": True,
        "channel_push": True,
        "channel_email": True,
    }


def test_patch_settings_accepts_active_scheduling_fields_without_duration_weight(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)

    response = client.patch(
        "/settings",
        headers=auth_headers,
        json={
            "ai_scheduling": {
                "ai_assistant_enabled": True,
                "ai_deadline_urgency_weight": 95,
                "ai_priority_weight": 5,
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["ai_scheduling"] == {
        "ai_assistant_enabled": True,
        "ai_deadline_urgency_weight": 95,
        "ai_priority_weight": 5,
        "ai_estimated_duration_weight": 50,
    }


def test_patch_settings_accepts_legacy_duration_weight_payload(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)

    response = client.patch(
        "/settings",
        headers=auth_headers,
        json={
            "ai_scheduling": {
                "ai_estimated_duration_weight": 10,
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["ai_scheduling"]["ai_estimated_duration_weight"] == 10


def test_get_settings_preserves_existing_legacy_duration_weight(
    client: TestClient,
) -> None:
    auth_headers = create_auth_headers(client)
    legacy_update = client.patch(
        "/settings",
        headers=auth_headers,
        json={
            "ai_scheduling": {
                "ai_estimated_duration_weight": 0,
            },
        },
    )
    assert legacy_update.status_code == 200

    response = client.get("/settings", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["ai_scheduling"]["ai_estimated_duration_weight"] == 0


def test_patch_settings_validates_input(client: TestClient) -> None:
    auth_headers = create_auth_headers(client)

    invalid_weight_response = client.patch(
        "/settings",
        headers=auth_headers,
        json={
            "ai_scheduling": {
                "ai_priority_weight": 101,
            },
        },
    )
    invalid_pomodoro_response = client.patch(
        "/settings",
        headers=auth_headers,
        json={
            "work_pattern": {
                "pomodoro_minutes": 0,
            },
        },
    )
    invalid_time_response = client.patch(
        "/settings",
        headers=auth_headers,
        json={
            "work_pattern": {
                "work_start": "18:00",
                "work_end": "09:00",
            },
        },
    )

    assert invalid_weight_response.status_code == 422
    assert invalid_pomodoro_response.status_code == 422
    assert invalid_time_response.status_code == 422


def test_patch_settings_validates_merged_work_window(client: TestClient) -> None:
    auth_headers = create_auth_headers(client)

    response = client.patch(
        "/settings",
        headers=auth_headers,
        json={
            "work_pattern": {
                "work_start": "18:00",
            },
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "work_end must be later than work_start"


def test_settings_are_isolated_by_user(client: TestClient) -> None:
    auth_headers = create_auth_headers(client)
    other_headers = create_auth_headers(client, "other-settings-test")

    response = client.patch(
        "/settings",
        headers=auth_headers,
        json={
            "work_pattern": {
                "work_start": "07:15",
            },
            "channels": {
                "channel_email": False,
            },
        },
    )
    assert response.status_code == 200

    own_response = client.get("/settings", headers=auth_headers)
    other_response = client.get("/settings", headers=other_headers)

    assert own_response.status_code == 200
    assert other_response.status_code == 200
    assert own_response.json()["work_pattern"]["work_start"] == "07:15"
    assert own_response.json()["channels"]["channel_email"] is False
    assert other_response.json()["work_pattern"]["work_start"] == "09:00"
    assert other_response.json()["channels"]["channel_email"] is True
