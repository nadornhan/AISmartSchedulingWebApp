import uuid
from pathlib import Path

from fastapi import UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.schemas import UserRegister
from app.auth.security import hash_password, verify_password
from app.config import get_settings


class DuplicateUserEmailError(ValueError):
    """Raised when a user email already exists."""


class AvatarUploadError(ValueError):
    """Raised when an avatar upload fails validation or storage."""

    def __init__(
        self,
        detail: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
    ) -> None:
        super().__init__(detail)
        self.status_code = status_code


ALLOWED_AVATAR_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    statement = select(User).where(User.email == normalize_email(email))
    return db.scalar(statement)


def create_user(db: Session, user_data: UserRegister) -> User:
    user = User(
        email=normalize_email(str(user_data.email)),
        first_name=user_data.first_name.strip(),
        last_name=user_data.last_name.strip(),
        role=user_data.role,
        password_hash=hash_password(user_data.password),
    )

    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise DuplicateUserEmailError from error

    db.refresh(user)

    return user


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> User | None:
    user = get_user_by_email(db, email)

    if user is None:
        return None

    if not user.is_active:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user


def detect_avatar_mime(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"

    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"

    return None


async def save_user_avatar(
    db: Session,
    user: User,
    upload: UploadFile,
) -> User:
    settings = get_settings()
    original_name = upload.filename or ""
    extension = Path(original_name).suffix.lower()
    expected_mime = ALLOWED_AVATAR_TYPES.get(extension)

    if expected_mime is None:
        raise AvatarUploadError("Avatar must be a JPEG, PNG, or WebP image.")

    if upload.content_type != expected_mime:
        raise AvatarUploadError("Avatar MIME type does not match the file extension.")

    content = await upload.read(settings.avatar_max_bytes + 1)

    if len(content) > settings.avatar_max_bytes:
        raise AvatarUploadError(
            "Avatar must be 2 MB or smaller.",
            status.HTTP_413_CONTENT_TOO_LARGE,
        )

    detected_mime = detect_avatar_mime(content)

    if detected_mime != expected_mime:
        raise AvatarUploadError("Avatar content is not a valid image type.")

    avatar_directory = settings.upload_dir / "avatars"
    avatar_directory.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4()}{'.jpg' if extension == '.jpeg' else extension}"
    destination = avatar_directory / filename
    destination.write_bytes(content)

    user.avatar_path = f"avatars/{filename}"
    db.commit()
    db.refresh(user)

    return user


def delete_user_avatar(
    db: Session,
    user: User,
) -> User:
    user.avatar_path = None
    db.commit()
    db.refresh(user)

    return user
