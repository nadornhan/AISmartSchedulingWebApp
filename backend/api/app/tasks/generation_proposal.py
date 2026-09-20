import hmac
from datetime import datetime, timedelta
from uuid import UUID, uuid4

import jwt

from app.config import get_settings

PROPOSAL_AUDIENCE = "chrono:task-generation:v1"
PROPOSAL_TTL = timedelta(minutes=15)


def _key() -> bytes:
    return hmac.digest(
        get_settings().jwt_secret_key.encode(),
        PROPOSAL_AUDIENCE.encode(),
        "sha256",
    )


def create_token(*, user_id: UUID, now: datetime) -> tuple[UUID, str, datetime]:
    proposal_id = uuid4()
    expires_at = now + PROPOSAL_TTL
    token = jwt.encode(
        {
            "aud": PROPOSAL_AUDIENCE,
            "sub": str(user_id),
            "jti": str(proposal_id),
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
        },
        _key(),
        algorithm="HS256",
    )
    return proposal_id, token, expires_at


def verify_token(token: str, *, user_id: UUID) -> UUID:
    try:
        claims = jwt.decode(
            token,
            _key(),
            algorithms=["HS256"],
            audience=PROPOSAL_AUDIENCE,
            options={"require": ["aud", "sub", "jti", "iat", "exp"]},
        )
        proposal_id = UUID(claims["jti"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise ValueError("Invalid or expired task preview. Generate a new preview.") from None
    if claims["sub"] != str(user_id):
        raise LookupError("Task preview not found")
    return proposal_id
