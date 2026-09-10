from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, SessionLocal, engine, get_db


def test_database_settings_use_postgresql_psycopg() -> None:
    settings = get_settings()

    assert settings.database_url.startswith("postgresql+psycopg://")


def test_database_engine_is_configured() -> None:
    assert isinstance(engine, Engine)
    assert engine.url.drivername == "postgresql+psycopg"
    assert engine.pool._pre_ping is True


def test_shared_declarative_base_is_available() -> None:
    assert Base.metadata is not None


def test_get_db_provides_session() -> None:
    dependency = get_db()
    session = next(dependency)

    try:
        assert isinstance(session, Session)
        assert session.bind is engine
    finally:
        dependency.close()


def test_session_factory_uses_shared_engine() -> None:
    session = SessionLocal()

    try:
        assert session.bind is engine
    finally:
        session.close()