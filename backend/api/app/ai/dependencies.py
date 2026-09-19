from functools import lru_cache
from typing import TypeVar

from pydantic import BaseModel

from app.ai.exceptions import AIDisabledError
from app.ai.gemini import GeminiProvider
from app.ai.limiter import AIRequestLimiter
from app.ai.provider import AIProvider
from app.ai.schemas import StructuredGenerationResult
from app.ai.service import AIService
from app.ai.telemetry import (
    CompositeAITelemetryRecorder,
    DatabaseAITelemetryRecorder,
    LoggingAITelemetryRecorder,
)
from app.config import get_settings
from app.database import SessionLocal

StructuredDataT = TypeVar("StructuredDataT", bound=BaseModel)


class DisabledAIProvider:
    @property
    def source_name(self) -> str:
        return "disabled"

    @property
    def model_name(self) -> str:
        return "none"

    def generate_structured(
        self,
        *,
        prompt: str,
        response_schema: type[StructuredDataT],
        feature: str,
        prompt_version: str,
    ) -> StructuredGenerationResult[StructuredDataT]:
        del prompt, response_schema, feature, prompt_version
        raise AIDisabledError("AI features are disabled")


@lru_cache
def get_ai_service() -> AIService:
    settings = get_settings()
    provider: AIProvider
    if settings.ai_enabled:
        provider = GeminiProvider(settings)
    else:
        provider = DisabledAIProvider()
    return AIService(
        provider,
        AIRequestLimiter(settings.ai_requests_per_user_per_minute),
        CompositeAITelemetryRecorder(
            [
                LoggingAITelemetryRecorder(),
                DatabaseAITelemetryRecorder(SessionLocal),
            ]
        ),
    )
