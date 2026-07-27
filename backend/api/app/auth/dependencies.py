import uuid
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.security import decode_access_token
from app.auth.service import get_user_by_id
from app.database import get_db

bearer_scheme = HTTPBearer()

DatabaseSession = Annotated[Session, Depends(get_db)]
BearerCredentials = Annotated[
    HTTPAuthorizationCredentials,
    Depends(bearer_scheme),
]


def get_current_user(
    credentials: BearerCredentials,
    db: DatabaseSession,
) -> User:
    authentication_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(credentials.credentials)
        subject = payload.get("sub")

        if not isinstance(subject, str):
            raise authentication_error

        user_id = uuid.UUID(subject)
    except (jwt.InvalidTokenError, ValueError):
        raise authentication_error from None

    user = get_user_by_id(db, user_id)

    if user is None or not user.is_active:
        raise authentication_error

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]