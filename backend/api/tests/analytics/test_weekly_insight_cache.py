"""Run against a migrated, dedicated PostgreSQL test database."""

import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import UTC, datetime
from threading import Event
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.analytics import service
from app.analytics.models import WeeklyAIInsight
from app.analytics.schemas import WeeklyInsightNarrative
from app.auth.models import User
from app.database import engine


def test_concurrent_weekly_requests_generate_once():
    if engine.dialect.name != "postgresql":
        pytest.skip("Row-lock behavior must be tested with PostgreSQL")

    user_id = uuid.uuid4()
    reference = datetime(2026, 9, 16, 12, tzinfo=UTC)
    generating = Event()
    release = Event()
    second_started = Event()

    def generate(**kwargs):
        generating.set()
        assert release.wait(10), "Test did not release generation"
        return SimpleNamespace(
            data=WeeklyInsightNarrative(narrative="Your weekly insight."),
            metadata=SimpleNamespace(model="test", prompt_version="weekly-insights-v1"),
        )

    ai = SimpleNamespace(generate_structured=Mock(side_effect=generate))

    def request(started=None):
        # Each request needs its own connection and transaction.
        with Session(engine) as db:
            user = db.get(User, user_id)
            if started is not None:
                started.set()
            return service.get_or_create_weekly_insight(
                db, user, ai_service=ai, reference=reference
            )

    with Session(engine) as db:
        db.add(User(id=user_id, email=f"weekly-lock-{user_id}@example.com", password_hash="test"))
        db.commit()

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            try:
                first = pool.submit(request)
                assert generating.wait(10)
                second = pool.submit(request, second_started)
                assert second_started.wait(10)
                # The second request must wait while the first holds the lock.
                with pytest.raises(TimeoutError):
                    second.result(timeout=0.5)
            finally:
                release.set()
            responses = [first.result(timeout=10), second.result(timeout=10)]

        assert ai.generate_structured.call_count == 1
        assert sorted(result.cached for result in responses) == [False, True]
        assert responses[0].narrative == responses[1].narrative
        assert responses[0].metrics == responses[1].metrics
        assert request().cached is True
        assert ai.generate_structured.call_count == 1
        with Session(engine) as db:
            assert db.scalar(
                select(func.count()).select_from(WeeklyAIInsight)
                .where(WeeklyAIInsight.user_id == user_id)
            ) == 1
    finally:
        with Session(engine) as db:
            db.execute(delete(WeeklyAIInsight).where(WeeklyAIInsight.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
