import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from pydantic import ValidationError

from app.config import get_settings
from app.tasks.duration_estimation.schemas import DurationEstimate, DurationProposalData

PROPOSAL_AUDIENCE = "chrono:duration-proposal:v1"
PROPOSAL_TTL = timedelta(minutes=15)


class DurationConflict(ValueError):
    pass


def task_snapshot(task) -> str:
    values = {
        "id": str(task.id),
        "updated_at": task.updated_at.isoformat(),
        "title": task.title,
        "description": task.description,
        "status": task.status.value,
        "estimate": task.estimated_duration_minutes,
        "project_id": str(task.project_id),
        "subtasks": sorted((str(s.id), s.title, s.is_completed, s.position) for s in task.subtasks),
    }
    return hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()


def _key() -> bytes:
    # Domain-separated signing key: an access JWT can never act as a duration proposal.
    return hmac.digest(get_settings().jwt_secret_key.encode(), PROPOSAL_AUDIENCE.encode(), "sha256")


def create_proposal(estimate: DurationEstimate, *, user_id: UUID, task, now=None):
    now = now or datetime.now(UTC)
    expires_at = now + PROPOSAL_TTL
    proposal_id = uuid4()
    claims = {
        "aud": PROPOSAL_AUDIENCE,
        "sub": str(user_id),
        "task_id": str(task.id),
        "jti": str(proposal_id),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "snapshot": task_snapshot(task),
        "estimate": estimate.model_dump(mode="json"),
    }
    token = jwt.encode(claims, _key(), algorithm="HS256")
    return DurationProposalData(
        **estimate.model_dump(),
        proposal_id=proposal_id,
        proposal_token=token,
        expires_at=expires_at,
    )


def verify_proposal(token: str, *, user_id: UUID, task_id: UUID) -> dict:
    try:
        claims = jwt.decode(
            token,
            _key(),
            algorithms=["HS256"],
            audience=PROPOSAL_AUDIENCE,
            options={
                "verify_exp": False,
                "require": ["aud", "sub", "jti", "iat", "exp", "task_id", "snapshot", "estimate"],
            },
        )
        UUID(claims["jti"])
        if not isinstance(claims["exp"], int) or not isinstance(claims["snapshot"], str):
            raise TypeError("Invalid claims")
        DurationEstimate.model_validate(claims["estimate"])
    except (jwt.InvalidTokenError, ValidationError, ValueError, TypeError, KeyError):
        raise ValueError("Invalid duration proposal. Request a new estimate.") from None
    if claims["sub"] != str(user_id) or claims["task_id"] != str(task_id):
        raise LookupError("Duration proposal not found")
    return claims


def request_fingerprint(token: str, action: str, duration_minutes: int | None) -> str:
    return hashlib.sha256(json.dumps([token, action, duration_minutes]).encode()).hexdigest()
