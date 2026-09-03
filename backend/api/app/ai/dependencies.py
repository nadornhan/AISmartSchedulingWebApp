from functools import lru_cache
from typing import TypeVar

from pydantic import BaseModel

from app.ai.exceptions import AIDisabledError
from app.ai.gemini import GeminiProvider
from app.ai.limiter import AIRequestLimiter
from app.ai.provider import AIProvider
from app.ai.schemas import StructuredGenerationResult
from app.ai.service import AIService
from app.config import get_settings

StructuredDataT = TypeVar("StructuredDataT", bound=BaseModel)


class DisabledAIProvider:
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
    )
