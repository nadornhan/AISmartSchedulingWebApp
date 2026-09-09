from __future__ import annotations

from typing import Protocol, TypeVar

from pydantic import BaseModel

from app.ai.schemas import StructuredGenerationResult

StructuredDataT = TypeVar("StructuredDataT", bound=BaseModel)


class AIProvider(Protocol):
    @property
    def source_name(self) -> str: ...

    @property
    def model_name(self) -> str: ...

    def generate_structured(
        self,
        *,
        prompt: str,
        response_schema: type[StructuredDataT],
        feature: str,
        prompt_version: str,
    ) -> StructuredGenerationResult[StructuredDataT]: ...
