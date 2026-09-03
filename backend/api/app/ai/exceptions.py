class AIError(Exception):
    """Base class for sanitized AI failures safe to handle inside the app."""

    code = "ai_error"


class AIDisabledError(AIError):
    code = "ai_disabled"


class AIConfigurationError(AIError):
    code = "ai_configuration_error"


class AIAuthenticationError(AIError):
    code = "ai_authentication_error"


class AIModelUnavailableError(AIError):
    code = "ai_model_unavailable"


class AIQuotaError(AIError):
    code = "ai_quota_exhausted"


class AITimeoutError(AIError):
    code = "ai_timeout"


class AIUpstreamError(AIError):
    code = "ai_upstream_error"


class AIInvalidResponseError(AIError):
    code = "ai_invalid_response"


class AIRequestLimitError(AIError):
    code = "ai_user_rate_limit"
