from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable
from typing import TypeVar

from pydantic import BaseModel

from app.ai.exceptions import AIContractError, AIError
from app.ai.limiter import AIRequestLimiter
from app.ai.policies import AIFeature, get_ai_feature_policy
from app.ai.provider import AIProvider
from app.ai.schemas import AIGenerationMetadata, StructuredGenerationResult

logger = logging.getLogger(__name__)
StructuredDataT = TypeVar("StructuredDataT", bound=BaseModel)


class AIService:
    def __init__(self, provider: AIProvider, limiter: AIRequestLimiter) -> None:
        self.provider = provider
        self.limiter = limiter

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
            self.limiter.check(user_key)
            result = self.provider.generate_structured(
                prompt=prompt,
                response_schema=response_schema,
                feature=registered_feature.value,
                prompt_version=prompt_version,
            )
        except AIError as exc:
            if fallback is None:
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
        self._log_metadata(user_key, result.metadata)
        return result

    @staticmethod
    def _log_metadata(user_key: str, metadata: AIGenerationMetadata) -> None:
        event = {
            "event": "ai_generation",
            "user_key": user_key,
            **metadata.model_dump(mode="json"),
        }
        logger.info("%s", json.dumps(event, separators=(",", ":"), sort_keys=True))
