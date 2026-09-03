from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AIUsageMetadata(BaseModel):
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    thinking_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)


class AIGenerationMetadata(BaseModel):
    feature: str = Field(min_length=1, max_length=64)
    prompt_version: str = Field(min_length=1, max_length=64)
    source: Literal["gemini", "fake", "deterministic_fallback"]
    model: str
    latency_ms: int = Field(ge=0)
    usage: AIUsageMetadata = Field(default_factory=AIUsageMetadata)
    fallback_reason: str | None = None


class StructuredGenerationResult[StructuredDataT: BaseModel](BaseModel):
    data: StructuredDataT
    metadata: AIGenerationMetadata
