import uuid

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.auth.models import User
from app.auth.security import create_access_token, hash_password, verify_password
from app.config import get_settings


def unique_email(prefix: str = "auth-test") -> str:
    return f"{prefix}-{uuid.uuid4()}@example.com"


def register_user(
    client: TestClient,
    email: str | None = None,
    password: str = "TestPassword123",
    **overrides: object,
) -> tuple[str, str, dict]:
    user_email = email or unique_email()
    payload = {
        "email": user_email,
        "password": password,
        "first_name": "Alex",
        "last_name": "Nguyen",
        "role": "student",
        **overrides,
    }

    response = client.post("/auth/register", json=payload)

    assert response.status_code == 201
    return user_email, password, response.json()


def auth_headers_for(email: str, password: str, client: TestClient) -> dict[str, str]:
    response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )

    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_register_saves_profile_fields_and_hashes_password(
    client: TestClient,
    db_session: Session,
) -> None:
    password = "TestPassword123"
    email, _, user = register_user(
        client,
        password=password,
        first_name=" Minh ",
        last_name=" Cao ",
        role="teacher",
    )

    stored_user = db_session.get(User, uuid.UUID(user["id"]))

    assert stored_user is not None
    assert stored_user.email == email.lower()
    assert stored_user.first_name == "Minh"
    assert stored_user.last_name == "Cao"
    assert stored_user.role == "teacher"
    assert stored_user.password_hash != password
    assert verify_password(password, stored_user.password_hash)
    assert "password_hash" not in user


def test_register_rejects_duplicate_email_case_insensitively(
    client: TestClient,
) -> None:
    email = unique_email("duplicate").upper()
    register_user(client, email=email)

    response = client.post(
        "/auth/register",
        json={
            "email": email.lower(),
            "password": "TestPassword123",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "An account with this email already exists"


def test_register_rejects_invalid_role(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={
            "email": unique_email("invalid-role"),
            "password": "TestPassword123",
            "role": "owner",
        },
    )

    assert response.status_code == 422


def test_register_rejects_public_admin_signup(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={
            "email": unique_email("admin-signup"),
            "password": "TestPassword123",
            "role": "admin",
        },
    )

    assert response.status_code == 422


def test_login_returns_bearer_token_and_me_returns_current_user(
    client: TestClient,
) -> None:
    email, password, registered_user = register_user(client)
    headers = auth_headers_for(email.upper(), password, client)

    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 200
    current_user = response.json()
    assert current_user["id"] == registered_user["id"]
    assert current_user["email"] == email.lower()
    assert current_user["first_name"] == "Alex"
    assert current_user["last_name"] == "Nguyen"
    assert current_user["role"] == "student"
    assert current_user["avatar_url"] is None


def test_upload_avatar_accepts_valid_png(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "upload_dir", tmp_path)
    email, password, registered_user = register_user(client)
    headers = auth_headers_for(email, password, client)

    response = client.post(
        "/auth/me/avatar",
        files={
            "avatar": (
                "avatar.png",
                b"\x89PNG\r\n\x1a\nvalid-image-content",
                "image/png",
            ),
        },
        headers=headers,
    )

    assert response.status_code == 200

    current_user = response.json()
    stored_user = db_session.get(User, uuid.UUID(registered_user["id"]))

    assert stored_user is not None
    assert stored_user.avatar_path is not None
    assert current_user["avatar_url"] == f"/media/{stored_user.avatar_path}"
    assert stored_user.avatar_path.startswith("avatars/")
    assert ".." not in stored_user.avatar_path
    assert (tmp_path / stored_user.avatar_path).exists()


def test_upload_avatar_rejects_mismatched_mime_type(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "upload_dir", tmp_path)
    email, password, _ = register_user(client)
    headers = auth_headers_for(email, password, client)

    response = client.post(
        "/auth/me/avatar",
        files={
            "avatar": (
                "avatar.png",
                b"\x89PNG\r\n\x1a\nvalid-image-content",
                "image/jpeg",
            ),
        },
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Avatar MIME type does not match the file extension."
    )


def test_upload_avatar_rejects_oversized_file(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "upload_dir", tmp_path)
    email, password, _ = register_user(client)
    headers = auth_headers_for(email, password, client)
    oversized_avatar = b"\xff\xd8\xff" + b"0" * settings.avatar_max_bytes

    response = client.post(
        "/auth/me/avatar",
        files={
            "avatar": (
                "avatar.jpg",
                oversized_avatar,
                "image/jpeg",
            ),
        },
        headers=headers,
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "Avatar must be 2 MB or smaller."


def test_delete_avatar_clears_avatar_url(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "upload_dir", tmp_path)
    email, password, registered_user = register_user(client)
    headers = auth_headers_for(email, password, client)

    upload_response = client.post(
        "/auth/me/avatar",
        files={
            "avatar": (
                "avatar.png",
                b"\x89PNG\r\n\x1a\nvalid-image-content",
                "image/png",
            ),
        },
        headers=headers,
    )
    assert upload_response.status_code == 200
    assert upload_response.json()["avatar_url"] is not None

    delete_response = client.delete(
        "/auth/me/avatar",
        headers=headers,
    )

    stored_user = db_session.get(User, uuid.UUID(registered_user["id"]))

    assert delete_response.status_code == 200
    assert delete_response.json()["avatar_url"] is None
    assert stored_user is not None
    assert stored_user.avatar_path is None


def test_login_rejects_invalid_password(client: TestClient) -> None:
    email, _, _ = register_user(client)

    response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": "WrongPassword123",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_me_rejects_missing_or_invalid_token(client: TestClient) -> None:
    missing_response = client.get("/auth/me")
    invalid_response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert missing_response.status_code == 401
    assert invalid_response.status_code == 401


def test_inactive_user_cannot_login_or_use_existing_token(
    client: TestClient,
    db_session: Session,
) -> None:
    email, password, registered_user = register_user(client)
    stored_user = db_session.get(User, uuid.UUID(registered_user["id"]))

    assert stored_user is not None
    stored_user.is_active = False
    db_session.commit()

    login_response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )
    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {create_access_token(str(stored_user.id))}"},
    )

    assert login_response.status_code == 401
    assert me_response.status_code == 401


def test_admin_role_can_be_persisted_for_managed_accounts(
    db_session: Session,
) -> None:
    admin = User(
        email=unique_email("admin"),
        first_name="Admin",
        last_name="User",
        role="admin",
        password_hash=hash_password("TestPassword123"),
    )

    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)

    stored_user = db_session.get(User, admin.id)
    assert stored_user is not None
    assert stored_user.role == "admin"


def test_require_roles_allows_admin_and_rejects_other_roles() -> None:
    admin_user = User(
        email=unique_email("admin-role"),
        role="admin",
        password_hash="not-used",
    )
    student_user = User(
        email=unique_email("student-role"),
        role="student",
        password_hash="not-used",
    )
    require_admin = require_roles("admin")

    assert require_admin(admin_user) is admin_user

    with pytest.raises(HTTPException) as error:
        require_admin(student_user)

    assert error.value.status_code == 403
