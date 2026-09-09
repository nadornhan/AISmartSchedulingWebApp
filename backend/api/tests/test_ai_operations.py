from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.ai.exceptions import (
    AIAuthenticationError,
    AIConfigurationError,
    AIContractError,
    AIDisabledError,
    AIError,
    AIInvalidResponseError,
    AIModelUnavailableError,
    AIQuotaError,
    AIRequestLimitError,
    AITimeoutError,
    AIUpstreamError,
)
from app.ai.fake import FakeAIProvider, InMemoryAITelemetryRecorder
from app.ai.http import ai_error_handler
from app.ai.limiter import AIRequestLimiter
from app.ai.models import AIGenerationEvent
from app.ai.policies import AI_FEATURE_POLICIES
from app.ai.schemas import AIUsageEvent, AIUsageMetadata
from app.ai.service import AIService
from app.ai.telemetry import persist_ai_usage_event, summarize_ai_usage
from app.auth.models import User
from app.database import Base


class ExampleOutput(BaseModel):
    value: str


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        (AIRequestLimitError("private"), 429),
        (AIQuotaError("private"), 429),
        (AITimeoutError("private"), 504),
        (AIConfigurationError("private"), 503),
        (AIDisabledError("private"), 503),
        (AIAuthenticationError("private"), 502),
        (AIModelUnavailableError("private"), 502),
        (AIInvalidResponseError("private"), 502),
        (AIUpstreamError("private"), 502),
        (AIContractError("private"), 500),
    ],
)
def test_ai_errors_share_a_sanitized_http_envelope(error, expected_status: int) -> None:
    test_app = FastAPI()
    test_app.add_exception_handler(AIError, ai_error_handler)

    @test_app.get("/fail")
    def fail():
        raise error

    response = TestClient(test_app, raise_server_exceptions=False).get("/fail")

    assert response.status_code == expected_status
    assert response.json()["code"] == error.code
    assert isinstance(response.json()["retryable"], bool)
    assert "private" not in response.text


def test_all_registered_features_share_service_and_telemetry_contracts() -> None:
    provider = FakeAIProvider([{"value": "ok"}] * len(AI_FEATURE_POLICIES))
    recorder = InMemoryAITelemetryRecorder()
    service = AIService(provider, AIRequestLimiter(30), recorder)

    for feature, policy in AI_FEATURE_POLICIES.items():
        result = service.generate_structured(
            user_key=str(uuid.uuid4()),
            prompt=f"synthetic input for {feature.value}",
            response_schema=ExampleOutput,
            feature=feature,
            prompt_version=policy.prompt_version,
        )
        assert result.data.value == "ok"

    assert [event.feature for event in recorder.events] == [
        feature.value for feature in AI_FEATURE_POLICIES
    ]
    assert all(policy.requests_per_user_per_minute >= 1 for policy in AI_FEATURE_POLICIES.values())


def test_service_records_fallback_and_failure_without_prompt_content() -> None:
    recorder = InMemoryAITelemetryRecorder()
    service = AIService(FakeAIProvider(), AIRequestLimiter(10), recorder)

    fallback = service.generate_structured(
        user_key=str(uuid.uuid4()),
        prompt="sensitive task text",
        response_schema=ExampleOutput,
        feature="task_understanding",
        prompt_version="task-understanding-v1",
        fallback=lambda: ExampleOutput(value="fallback"),
    )
    assert fallback.metadata.source == "deterministic_fallback"

    with pytest.raises(AIInvalidResponseError):
        service.generate_structured(
            user_key=str(uuid.uuid4()),
            prompt="another sensitive task",
            response_schema=ExampleOutput,
            feature="task_understanding",
            prompt_version="task-understanding-v1",
        )

    assert [event.outcome for event in recorder.events] == ["fallback", "failure"]
    assert "sensitive" not in repr(recorder.events)


def test_telemetry_failure_never_breaks_a_valid_ai_result() -> None:
    class BrokenRecorder:
        def record(self, event) -> None:
            del event
            raise RuntimeError("telemetry unavailable")

    service = AIService(
        FakeAIProvider([{"value": "ok"}]),
        AIRequestLimiter(10),
        BrokenRecorder(),
    )

    result = service.generate_structured(
        user_key=str(uuid.uuid4()),
        prompt="safe synthetic task",
        response_schema=ExampleOutput,
        feature="task_understanding",
        prompt_version="task-understanding-v1",
    )

    assert result.data.value == "ok"


def test_ai_usage_persists_and_summarizes_by_feature() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(
        engine,
        tables=[User.__table__, AIGenerationEvent.__table__],
    )

    with Session(engine) as db_session:
        user = User(
            email=f"ai-telemetry-{uuid.uuid4()}@example.com",
            password_hash="not-used",
        )
        db_session.add(user)
        db_session.flush()
        now = datetime.now(UTC)

        for outcome in ("success", "fallback", "failure"):
            persist_ai_usage_event(
                db_session,
                AIUsageEvent(
                    user_key=str(user.id),
                    feature="task_understanding",
                    prompt_version="task-understanding-v1",
                    outcome=outcome,
                    source="fake",
                    model="fake",
                    latency_ms=12,
                    usage=AIUsageMetadata(input_tokens=2, output_tokens=3, total_tokens=5),
                    error_code=None if outcome == "success" else "test_error",
                    created_at=now,
                ),
            )

        records = db_session.scalars(
            select(AIGenerationEvent).where(AIGenerationEvent.user_id == user.id)
        ).all()
        summaries = summarize_ai_usage(db_session, user.id)

    assert len(records) == 3
    assert summaries[0].request_count == 3
    assert summaries[0].success_count == 1
    assert summaries[0].fallback_count == 1
    assert summaries[0].failure_count == 1
    assert summaries[0].total_tokens == 15
