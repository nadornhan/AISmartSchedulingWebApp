import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.schemas import UserRegister
from app.auth.security import hash_password, verify_password


class DuplicateUserEmailError(ValueError):
    """Raised when a user email already exists."""


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
