from __future__ import annotations

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.ai.exceptions import (
    AIAuthenticationError,
    AIConfigurationError,
    AIContractError,
    AIDisabledError,
    AIError,
    AIInvalidResponseError,
    AIModelUnavailableError,
    AIQuotaError,
    AIRequestLimitError,
    AITimeoutError,
    AIUpstreamError,
)

AIErrorTypes = type[AIError] | tuple[type[AIError], ...]

_ERROR_RESPONSES: tuple[tuple[AIErrorTypes, int, str, bool], ...] = (
    (
        AIRequestLimitError,
        status.HTTP_429_TOO_MANY_REQUESTS,
        "AI request limit reached. Please try again later.",
        True,
    ),
    (
        AIQuotaError,
        status.HTTP_429_TOO_MANY_REQUESTS,
        "AI quota is temporarily unavailable. Please try again later.",
        True,
    ),
    (
        AITimeoutError,
        status.HTTP_504_GATEWAY_TIMEOUT,
        "AI request timed out. Please try again.",
        True,
    ),
    (
        (AIConfigurationError, AIDisabledError),
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "AI service is currently unavailable.",
        True,
    ),
    (
        (
            AIAuthenticationError,
            AIInvalidResponseError,
            AIModelUnavailableError,
            AIUpstreamError,
        ),
        status.HTTP_502_BAD_GATEWAY,
        "AI could not produce a valid response.",
        True,
    ),
    (
        AIContractError,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "AI feature contract is invalid.",
        False,
    ),
)


async def ai_error_handler(_request: Request, exc: AIError) -> JSONResponse:
    for error_types, status_code, detail, retryable in _ERROR_RESPONSES:
        if isinstance(exc, error_types):
            return JSONResponse(
                status_code=status_code,
                content={
                    "detail": detail,
                    "code": exc.code,
                    "retryable": retryable,
                },
            )

    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={
            "detail": "AI service request failed.",
            "code": exc.code,
            "retryable": True,
        },
    )
