from __future__ import annotations

from typing import Protocol, TypeVar

from pydantic import BaseModel

from app.ai.schemas import StructuredGenerationResult

StructuredDataT = TypeVar("StructuredDataT", bound=BaseModel)


class AIProvider(Protocol):
    def generate_structured(
        self,
        *,
        prompt: str,
        response_schema: type[StructuredDataT],
        feature: str,
        prompt_version: str,
    ) -> StructuredGenerationResult[StructuredDataT]: ...
