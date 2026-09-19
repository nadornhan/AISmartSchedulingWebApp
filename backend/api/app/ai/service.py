from __future__ import annotations

import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import TypeVar

from pydantic import BaseModel

from app.ai.exceptions import AIContractError, AIError
from app.ai.limiter import AIRequestLimiter
from app.ai.policies import AIFeature, get_ai_feature_policy
from app.ai.provider import AIProvider
from app.ai.schemas import AIGenerationMetadata, AIUsageEvent, StructuredGenerationResult
from app.ai.telemetry import AITelemetryRecorder, LoggingAITelemetryRecorder

logger = logging.getLogger(__name__)
StructuredDataT = TypeVar("StructuredDataT", bound=BaseModel)


class AIService:
    def __init__(
        self,
        provider: AIProvider,
        limiter: AIRequestLimiter,
        telemetry_recorder: AITelemetryRecorder | None = None,
    ) -> None:
        self.provider = provider
        self.limiter = limiter
        self.telemetry_recorder = telemetry_recorder or LoggingAITelemetryRecorder()

    def generate_structured(
        self,
        *,
        user_key: str,
        prompt: str,
        response_schema: type[StructuredDataT],
        feature: AIFeature | str,
        prompt_version: str,
        fallback: Callable[[], StructuredDataT] | None = None,
    ) -> StructuredGenerationResult[StructuredDataT]:
        try:
            registered_feature = AIFeature(feature)
        except ValueError as exc:
            raise AIContractError(f"Unregistered AI feature: {feature}") from exc

        policy = get_ai_feature_policy(registered_feature)
        if prompt_version != policy.prompt_version:
            raise AIContractError(
                f"Prompt version {prompt_version!r} does not match registered "
                f"version {policy.prompt_version!r} for {registered_feature.value}"
            )

        started = time.perf_counter()
        try:
            self.limiter.check(
                user_key,
                feature=registered_feature.value,
                feature_requests_per_minute=policy.requests_per_user_per_minute,
            )
            result = self.provider.generate_structured(
                prompt=prompt,
                response_schema=response_schema,
                feature=registered_feature.value,
                prompt_version=prompt_version,
            )
        except AIError as exc:
            if fallback is None:
                self._record_safely(
                    AIUsageEvent(
                        user_key=user_key,
                        feature=registered_feature.value,
                        prompt_version=prompt_version,
                        outcome="failure",
                        source=getattr(self.provider, "source_name", "unknown"),
                        model=getattr(self.provider, "model_name", "unknown"),
                        latency_ms=round((time.perf_counter() - started) * 1000),
                        error_code=exc.code,
                        created_at=datetime.now(UTC),
                    )
                )
                raise
            result = StructuredGenerationResult[StructuredDataT](
                data=fallback(),
                metadata=AIGenerationMetadata(
                    feature=registered_feature.value,
                    prompt_version=prompt_version,
                    source="deterministic_fallback",
                    model="none",
                    latency_ms=round((time.perf_counter() - started) * 1000),
                    fallback_reason=exc.code,
                ),
            )
        self._record_safely(
            AIUsageEvent(
                user_key=user_key,
                feature=result.metadata.feature,
                prompt_version=result.metadata.prompt_version,
                outcome=(
                    "fallback"
                    if result.metadata.source == "deterministic_fallback"
                    else "success"
                ),
                source=result.metadata.source,
                model=result.metadata.model,
                latency_ms=result.metadata.latency_ms,
                usage=result.metadata.usage,
                error_code=result.metadata.fallback_reason,
                created_at=datetime.now(UTC),
            )
        )
        return result

    def _record_safely(self, event: AIUsageEvent) -> None:
        try:
            self.telemetry_recorder.record(event)
        except Exception:
            logger.warning(
                "AI telemetry recording failed for feature %s",
                event.feature,
                exc_info=True,
            )
