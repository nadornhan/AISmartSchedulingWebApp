from __future__ import annotations

from datetime import datetime
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


class AIUsageEvent(BaseModel):
    user_key: str = Field(min_length=1, max_length=128)
    feature: str = Field(min_length=1, max_length=64)
    prompt_version: str = Field(min_length=1, max_length=64)
    outcome: Literal["success", "fallback", "failure"]
    source: str = Field(min_length=1, max_length=32)
    model: str = Field(min_length=1, max_length=128)
    latency_ms: int = Field(ge=0)
    usage: AIUsageMetadata = Field(default_factory=AIUsageMetadata)
    error_code: str | None = Field(default=None, max_length=64)
    created_at: datetime


class AIUsageFeatureSummary(BaseModel):
    feature: str
    request_count: int = Field(ge=0)
    success_count: int = Field(ge=0)
    fallback_count: int = Field(ge=0)
    failure_count: int = Field(ge=0)
    total_tokens: int = Field(ge=0)
    average_latency_ms: float = Field(ge=0)
    fallback_rate: float = Field(ge=0)
    failure_rate: float = Field(ge=0)
    estimated_cost_usd: float = Field(ge=0)
    acceptance_rate: float | None = Field(default=None, ge=0, le=1)
