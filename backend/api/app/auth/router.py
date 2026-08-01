from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser
from app.auth.schemas import (
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)
from app.auth.security import create_access_token
from app.auth.service import (
    DuplicateUserEmailError,
    authenticate_user,
    create_user,
    get_user_by_email,
)
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

DatabaseSession = Annotated[Session, Depends(get_db)]


def duplicate_email_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="An account with this email already exists",
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user_data: UserRegister,
    db: DatabaseSession,
) -> UserResponse:
    existing_user = get_user_by_email(db, str(user_data.email))

    if existing_user is not None:
        raise duplicate_email_error()

    try:
        return create_user(db, user_data)
    except DuplicateUserEmailError:
        raise duplicate_email_error() from None


@router.post("/login", response_model=TokenResponse)
def login(
    credentials: UserLogin,
    db: DatabaseSession,
) -> TokenResponse:
    user = authenticate_user(
        db,
        str(credentials.email),
        credentials.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(str(user.id))

    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: CurrentUser) -> UserResponse:
    return current_user
