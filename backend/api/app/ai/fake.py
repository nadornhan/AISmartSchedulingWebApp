from __future__ import annotations

import time
from collections import deque
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.ai.exceptions import AIInvalidResponseError
from app.ai.schemas import (
    AIGenerationMetadata,
    AIUsageEvent,
    StructuredGenerationResult,
)

StructuredDataT = TypeVar("StructuredDataT", bound=BaseModel)


class FakeAIProvider:
    """Deterministic provider for tests; never makes a network request."""

    def __init__(self, responses: list[Any] | None = None) -> None:
        self.responses: deque[Any] = deque(responses or [])
        self.calls: list[dict[str, Any]] = []

    @property
    def source_name(self) -> str:
        return "fake"

    @property
    def model_name(self) -> str:
        return "fake"

    def queue(self, response: Any) -> None:
        self.responses.append(response)

    def generate_structured(
        self,
        *,
        prompt: str,
        response_schema: type[StructuredDataT],
        feature: str,
        prompt_version: str,
    ) -> StructuredGenerationResult[StructuredDataT]:
        self.calls.append(
            {
                "prompt": prompt,
                "response_schema": response_schema,
                "feature": feature,
                "prompt_version": prompt_version,
            }
        )
        if not self.responses:
            raise AIInvalidResponseError("Fake AI response queue is empty")
        started = time.perf_counter()
        try:
            data = response_schema.model_validate(self.responses.popleft())
        except ValidationError as exc:
            raise AIInvalidResponseError("Fake AI response failed schema validation") from exc
        return StructuredGenerationResult[StructuredDataT](
            data=data,
            metadata=AIGenerationMetadata(
                feature=feature,
                prompt_version=prompt_version,
                source="fake",
                model="fake",
                latency_ms=round((time.perf_counter() - started) * 1000),
            ),
        )


class InMemoryAITelemetryRecorder:
    """Inspectable telemetry sink shared by AI feature tests."""

    def __init__(self) -> None:
        self.events: list[AIUsageEvent] = []

    def record(self, event: AIUsageEvent) -> None:
        self.events.append(event.model_copy(deep=True))
