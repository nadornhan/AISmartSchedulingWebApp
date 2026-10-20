import pytest
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.health.router import liveness, readiness
from app.main import app


class AvailableDatabase:
    def execute(self, _statement: object) -> None:
        return None


class UnavailableDatabase:
    def execute(self, _statement: object) -> None:
        raise SQLAlchemyError("database unavailable")


def test_health_routes_are_registered() -> None:
    paths = set(app.openapi()["paths"])

    assert "/health/live" in paths
    assert "/health/ready" in paths


def test_liveness_does_not_require_database() -> None:
    assert liveness() == {"status": "ok"}


def test_readiness_checks_database() -> None:
    assert readiness(AvailableDatabase()) == {"status": "ok", "database": "ready"}


def test_readiness_returns_503_when_database_is_unavailable() -> None:
    with pytest.raises(HTTPException) as captured:
        readiness(UnavailableDatabase())

    assert captured.value.status_code == 503
    assert captured.value.detail == "Database is not ready"
