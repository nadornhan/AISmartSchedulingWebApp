from __future__ import annotations

import logging
from types import SimpleNamespace

import pytest
from pydantic import BaseModel, SecretStr

from app.ai.exceptions import (
    AIConfigurationError,
    AIInvalidResponseError,
    AIRequestLimitError,
    AITimeoutError,
    AIUpstreamError,
)
from app.ai.fake import FakeAIProvider
from app.ai.gemini import GeminiProvider
from app.ai.limiter import AIRequestLimiter
from app.ai.service import AIService
from app.config import Settings


class ExampleOutput(BaseModel):
    title: str
    confidence: float


def test_fake_provider_returns_validated_structured_data() -> None:
    provider = FakeAIProvider([{"title": "Plan report", "confidence": 0.8}])

    result = provider.generate_structured(
        prompt="Plan my report",
        response_schema=ExampleOutput,
        feature="task_draft",
        prompt_version="task-draft-v1",
    )

    assert result.data.title == "Plan report"
    assert result.metadata.source == "fake"
    assert provider.calls[0]["feature"] == "task_draft"


def test_fake_provider_rejects_invalid_response() -> None:
    provider = FakeAIProvider([{"confidence": 0.8}])

    with pytest.raises(AIInvalidResponseError):
        provider.generate_structured(
            prompt="Plan my report",
            response_schema=ExampleOutput,
            feature="task_draft",
            prompt_version="task-draft-v1",
        )


def test_service_uses_deterministic_fallback_and_records_reason(caplog) -> None:
    class FailingProvider:
        def generate_structured(self, **kwargs):
            del kwargs
            raise AIUpstreamError("provider unavailable")

    service = AIService(FailingProvider(), AIRequestLimiter(10))
    with caplog.at_level(logging.INFO, logger="app.ai.service"):
        result = service.generate_structured(
            user_key="user-1",
            prompt="Plan my report",
            response_schema=ExampleOutput,
            feature="task_draft",
            prompt_version="task-draft-v1",
            fallback=lambda: ExampleOutput(title="Plan my report", confidence=0.4),
        )

    assert result.metadata.source == "deterministic_fallback"
    assert result.metadata.fallback_reason == "ai_upstream_error"
    assert "Plan my report" not in caplog.text
    assert '"feature":"task_draft"' in caplog.text


def test_service_reraises_without_fallback() -> None:
    service = AIService(FakeAIProvider(), AIRequestLimiter(10))

    with pytest.raises(AIInvalidResponseError):
        service.generate_structured(
            user_key="user-1",
            prompt="Plan my report",
            response_schema=ExampleOutput,
            feature="task_draft",
            prompt_version="task-draft-v1",
        )


def test_request_limiter_is_scoped_per_user_and_uses_sliding_window() -> None:
    limiter = AIRequestLimiter(2)
    limiter.check("user-1", now=100)
    limiter.check("user-1", now=110)
    limiter.check("user-2", now=110)

    with pytest.raises(AIRequestLimitError):
        limiter.check("user-1", now=120)

    limiter.check("user-1", now=161)


def test_ai_configuration_validates_limits() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://example",
        jwt_secret_key="secret",
        gemini_api_key=SecretStr("test-key"),
        ai_requests_per_user_per_minute=12,
        gemini_max_retries=2,
    )

    assert settings.gemini_api_key is not None
    assert settings.gemini_api_key.get_secret_value() == "test-key"
    assert settings.ai_requests_per_user_per_minute == 12
    assert settings.gemini_max_retries == 2


def test_gemini_provider_requires_an_api_key() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://example",
        jwt_secret_key="secret",
        gemini_api_key=None,
    )

    with pytest.raises(AIConfigurationError):
        GeminiProvider(settings).generate_structured(
            prompt="Plan my report",
            response_schema=ExampleOutput,
            feature="task_draft",
            prompt_version="task-draft-v1",
        )


def test_gemini_provider_validates_response_and_collects_usage() -> None:
    response = SimpleNamespace(
        parsed={"title": "Plan report", "confidence": 0.9},
        usage_metadata=SimpleNamespace(
            prompt_token_count=12,
            candidates_token_count=8,
            thoughts_token_count=2,
            total_token_count=22,
        ),
    )
    models = SimpleNamespace(generate_content=lambda **kwargs: response)
    client_factory = lambda **kwargs: SimpleNamespace(models=models)
    settings = Settings(
        database_url="postgresql+psycopg://example",
        jwt_secret_key="secret",
        gemini_api_key=SecretStr("test-key"),
        gemini_max_retries=0,
    )

    result = GeminiProvider(settings, client_factory=client_factory).generate_structured(
        prompt="Plan my report",
        response_schema=ExampleOutput,
        feature="task_draft",
        prompt_version="task-draft-v1",
    )

    assert result.data == ExampleOutput(title="Plan report", confidence=0.9)
    assert result.metadata.usage.total_tokens == 22


def test_gemini_provider_maps_timeout_to_sanitized_error() -> None:
    def timeout_client(**kwargs):
        del kwargs
        raise TimeoutError("socket details must not escape")

    settings = Settings(
        database_url="postgresql+psycopg://example",
        jwt_secret_key="secret",
        gemini_api_key=SecretStr("test-key"),
        gemini_max_retries=0,
    )

    with pytest.raises(AITimeoutError, match="Gemini request timed out"):
        GeminiProvider(settings, client_factory=timeout_client).generate_structured(
            prompt="Plan my report",
            response_schema=ExampleOutput,
            feature="task_draft",
            prompt_version="task-draft-v1",
        )
