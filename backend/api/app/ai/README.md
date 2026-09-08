# CHRONO AI Foundation

Feature modules must call `AIService`; they must not instantiate the Gemini SDK
directly. This keeps secrets, validation, quota handling, telemetry, and fallback
behaviour consistent across task parsing, duration estimation, priority,
rescheduling, and weekly insights.

The shared integration contracts are intentionally separate from feature logic:

- `policies.py` is the registry for feature names, prompt versions, invocation
  modes, confirmation rules, and ownership.
- `routing.py` decides whether a clear task stays on the deterministic parser or
  needs Gemini. Feature code supplies parser facts; this module does not guess by
  scanning user text.
- `contracts.py` converts deterministic scoring output into versioned AI context
  and provides the common preview/confirmation envelope.

Do not invent a new feature string, prompt version, confidence threshold, or
response lifecycle inside a feature branch. Add or change it in this shared layer
and cover the contract with tests.

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
    feature=AIFeature.TASK_UNDERSTANDING,
    prompt_version="task-understanding-v1",
    fallback=build_rule_based_draft,
)
```

Do not include passwords, JWTs, API keys, unrelated notification history, or
another user's data in a prompt. Do not call AI on every keystroke or page load.
One explicit user action should produce at most one model request.

`AIService` rejects unregistered feature names and mismatched prompt versions.
When a prompt contract changes, add a new registered version and update its tests
instead of silently changing the meaning of an existing prompt.

Scoring and scheduling remain authoritative. Gemini may explain a score or compare
options already validated by the backend, but it must not calculate deadlines,
availability, overlaps, score totals, analytics totals, or final schedule validity.
All task, decomposition, duration, priority, and rescheduling outputs are previews;
write to PostgreSQL only in a separate authenticated confirmation request.

The bundled limiter is deliberately process-local for development. Production
with multiple API workers must replace it with a shared Redis or PostgreSQL
implementation behind the same `check(user_key)` interface.
