from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any, TypeVar

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from app.ai.exceptions import (
    AIAuthenticationError,
    AIConfigurationError,
    AIInvalidResponseError,
    AIModelUnavailableError,
    AIQuotaError,
    AITimeoutError,
    AIUpstreamError,
)
from app.ai.schemas import AIGenerationMetadata, AIUsageMetadata, StructuredGenerationResult
from app.config import Settings

StructuredDataT = TypeVar("StructuredDataT", bound=BaseModel)
ClientFactory = Callable[..., genai.Client]


class GeminiProvider:
    def __init__(
        self,
        settings: Settings,
        *,
        client_factory: ClientFactory = genai.Client,
    ) -> None:
        self.settings = settings
        self.client_factory = client_factory

    def generate_structured(
        self,
        *,
        prompt: str,
        response_schema: type[StructuredDataT],
        feature: str,
        prompt_version: str,
    ) -> StructuredGenerationResult[StructuredDataT]:
        api_key = self.settings.gemini_api_key
        if api_key is None or not api_key.get_secret_value().strip():
            raise AIConfigurationError("Gemini API key is not configured")

        started = time.perf_counter()
        response: Any = None
        for attempt in range(self.settings.gemini_max_retries + 1):
            try:
                client = self.client_factory(
                    api_key=api_key.get_secret_value(),
                    http_options=types.HttpOptions(
                        timeout=int(self.settings.gemini_timeout_seconds * 1000),
                        retry_options=types.HttpRetryOptions(attempts=1),
                    ),
                )
                response = client.models.generate_content(
                    model=self.settings.gemini_model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=response_schema,
                        max_output_tokens=self.settings.gemini_max_output_tokens,
                    ),
                )
                break
            except errors.ClientError as exc:
                self._raise_client_error(exc)
            except errors.ServerError as exc:
                if attempt >= self.settings.gemini_max_retries:
                    raise AIUpstreamError("Gemini is temporarily unavailable") from exc
                self._backoff(attempt)
            except TimeoutError as exc:
                if attempt >= self.settings.gemini_max_retries:
                    raise AITimeoutError("Gemini request timed out") from exc
                self._backoff(attempt)
            except (
                AIAuthenticationError,
                AIConfigurationError,
                AIModelUnavailableError,
                AIQuotaError,
            ):
                raise
            except Exception as exc:
                if attempt >= self.settings.gemini_max_retries:
                    raise AIUpstreamError("Gemini request failed") from exc
                self._backoff(attempt)

        if response is None:
            raise AIUpstreamError("Gemini returned no response")

        data = self._parse_response(response, response_schema)
        latency_ms = round((time.perf_counter() - started) * 1000)
        return StructuredGenerationResult[StructuredDataT](
            data=data,
            metadata=AIGenerationMetadata(
                feature=feature,
                prompt_version=prompt_version,
                source="gemini",
                model=self.settings.gemini_model,
                latency_ms=latency_ms,
                usage=self._usage_from_response(response),
            ),
        )

    @staticmethod
    def _backoff(attempt: int) -> None:
        time.sleep(min(0.25 * (2**attempt), 1.0))

    @staticmethod
    def _parse_response(response: Any, schema: type[StructuredDataT]) -> StructuredDataT:
        parsed = getattr(response, "parsed", None)
        try:
            if isinstance(parsed, schema):
                return parsed
            if parsed is not None:
                return schema.model_validate(parsed)
            text = getattr(response, "text", None)
            if isinstance(text, str) and text.strip():
                return schema.model_validate_json(text)
        except (ValidationError, ValueError, TypeError) as exc:
            raise AIInvalidResponseError("Gemini response failed schema validation") from exc
        raise AIInvalidResponseError("Gemini returned an empty structured response")

    @staticmethod
    def _usage_from_response(response: Any) -> AIUsageMetadata:
        usage = getattr(response, "usage_metadata", None)
        if usage is None:
            return AIUsageMetadata()
        return AIUsageMetadata(
            input_tokens=max(0, getattr(usage, "prompt_token_count", 0) or 0),
            output_tokens=max(0, getattr(usage, "candidates_token_count", 0) or 0),
            thinking_tokens=max(0, getattr(usage, "thoughts_token_count", 0) or 0),
            total_tokens=max(0, getattr(usage, "total_token_count", 0) or 0),
        )

    @staticmethod
    def _raise_client_error(exc: errors.ClientError) -> None:
        code = getattr(exc, "code", None)
        status = str(getattr(exc, "status", "") or "").upper()
        if code == 429:
            raise AIQuotaError("Gemini quota is exhausted") from exc
        if code in {401, 403} or "AUTH" in status or "PERMISSION" in status:
            raise AIAuthenticationError("Gemini authentication failed") from exc
        if code == 404 or "MODEL" in status or "NOT_FOUND" in status:
            raise AIModelUnavailableError("Configured Gemini model is unavailable") from exc
        if code == 408:
            raise AITimeoutError("Gemini request timed out") from exc
        raise AIUpstreamError("Gemini rejected the request") from exc
