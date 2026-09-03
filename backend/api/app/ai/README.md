# CHRONO AI Foundation

Feature modules must call `AIService`; they must not instantiate the Gemini SDK
directly. This keeps secrets, validation, quota handling, telemetry, and fallback
behaviour consistent across task parsing, duration estimation, priority,
rescheduling, and weekly insights.

## Local setup

Copy `backend/api/.env.example` to `backend/api/.env`, then set:

```dotenv
AI_ENABLED=true
GEMINI_API_KEY=your_personal_free_tier_key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Never commit `.env` or expose the key through a frontend environment variable.
Use synthetic data with free-tier projects. Automated tests must use
`FakeAIProvider` and must never consume Gemini quota.

## Feature usage

Define a strict Pydantic response model and a versioned prompt. Pass a
deterministic fallback whenever the feature can produce a useful result without
AI.

```python
result = ai_service.generate_structured(
    user_key=str(current_user.id),
    prompt=prompt,
    response_schema=TaskDraft,
    feature="task_draft",
    prompt_version="task-draft-v1",
    fallback=build_rule_based_draft,
)
```

Do not include passwords, JWTs, API keys, unrelated notification history, or
another user's data in a prompt. Do not call AI on every keystroke or page load.
One explicit user action should produce at most one model request.

The bundled limiter is deliberately process-local for development. Production
with multiple API workers must replace it with a shared Redis or PostgreSQL
implementation behind the same `check(user_key)` interface.
