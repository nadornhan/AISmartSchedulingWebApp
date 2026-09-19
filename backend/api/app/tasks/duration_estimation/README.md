# Personalized task duration

This package estimates **total active work**, not remaining time, calendar lead time,
or a valid scheduling slot. Existing scheduling/scoring code remains authoritative.

## API and UI

- `POST /tasks/{task_id}/duration/preview`: authenticated, existing unfinished task.
  No body. Returns `AIProposalEnvelope[DurationProposalData]` (`ai-context-v1`).
- `POST /tasks/{task_id}/duration/confirm`: body contains `proposal_token`, `action`
  (`accepted`, `changed`, `ignored`) and, only for `changed`, `duration_minutes`.
- The Edit Task modal exposes **Estimate time**. Save other edits first. Preview
  shows duration, confidence, sample count, factor, explanation and an editable
  duration. Apply saves immediately; Dismiss records ignored. Creating a new task
  does not call these endpoints because it has no persisted task ID yet.
- Closing/saving/deleting the modal with an unresolved estimate requires resolving
  it first. Closing a browser tab cannot reliably be recorded as ignored.
- Failed confirmation with an uncertain network/server outcome is retried with the
  identical payload. Successful updates emit the existing task-data-changed event.

## Modules

`router` authenticates and maps HTTP errors; `service` coordinates the workflow;
`repository` performs user-scoped SQL; `engine` contains pure, versioned heuristics;
`prompt` builds the semantic prior request; `proposal` signs and verifies proposals;
`schemas` validates contracts; `models` contains confirmation and baseline tables.

## Historical data and algorithm v1

SQL aggregates up to 200 completed tasks from the last 180 days, one sample per
task. Both tasks and focus sessions are filtered by authenticated user ID. Actual
minutes come from `actual_duration_seconds`, not planned session minutes. Sessions
must be completed, positive, have valid timestamps within the task lifetime and
plausible actual time. Tasks with positive partial/invalid sessions are excluded
conservatively, because a partial total is not a reliable full-task measurement.
The current task is excluded. Completion lead time is returned as context/quality
evidence, never substituted for work time.

Similarity uses case-folded Unicode words in title/description (Jaccard overlap
at least 0.25, with a 0.1 shared-project bonus only when words overlap). This is a
lexical heuristic, not semantic embeddings. Similar tasks are preferred. General
user history may calibrate ratios but never supplies an unrelated task's median
duration. The 200-task query cap is a bounded v1 approximation.

For cohorts of at least four samples, log-ratio median absolute deviation removes
outliers; similar cohorts also filter actual-time outliers. The rejection radius
is `max(3 * 1.4826 * MAD, log(2))`, including the zero-MAD case. With fewer samples,
only validity/bounds filtering is applied and confidence remains low.

When a prior is used, the heuristic adjustment is:

    n = number of usable actual/reference ratios
    factor = clamp(1 + n/(n+3) * (median(ratios)-1), 0.5, 2.0)
    suggested = round_to_five(prior * factor)

Valid final/edited durations are 1..10,080 minutes (seven days of active work).
The bound supports multi-session tasks and is not a scheduler availability limit.
Confidence is a backend heuristic based on count, spread and similarity; it is
not a statistically calibrated probability. Legacy estimates cap confidence.
Algorithm constants live in `engine.py` and `schemas.py`, independent of scoring
weights and the shared parser confidence threshold.

## Cold start and AI

Four or more valid similar tasks use their median actual time directly. Sparse
history may use Gemini as a semantic prior, through `AIService` only, with the
registered `duration_estimation` / `duration-estimation-v1` policy and strict
Pydantic output. Prompt input contains `AIInvocationContext` and bounded task text;
Gemini neither queries history nor calculates final factors/confidence.

If Gemini fails, or global/user AI is disabled: use comparable actual history,
then the current task estimate, then the user's Pomodoro default (25 when settings
do not exist). A history median is already personalized and is never multiplied
by a factor again. A default is explicitly labeled low-confidence. No-history AI
results use factor 1 and confidence 0.3. No-history defaults use confidence 0.15.

Generation attempts use shared AI limits and telemetry. Deterministic paths make
no generation attempt; their shared metadata uses `deterministic_fallback` with
`history_sufficient` or `ai_disabled`. The feature's `source` identifies the actual
source (`history`, `ai_prior`, `current_estimate`, `default`). No raw prompts or
generated narrative are added to AI telemetry.

## Baselines and limitations

At the first new focus write, `capture_baseline` freezes a reference within the
focus transaction. It uses the semantic prior of a matching confirmed estimate
when available; otherwise the saved user estimate. A null estimate stays null.
It never replaces existing baselines or backfills tasks with existing sessions.

Historical tasks without a snapshot use their current estimate marked
`legacy_current`, which may have been edited after work began. Until sufficient
AI-prior snapshots exist, transferring the user's estimation ratios to an AI
prior is an explicitly heuristic approximation. Focus only measures tracked work;
untracked work and changes in task scope limit accuracy. No model training occurs.

## Preview, confirmation, and persistence

Preview writes neither tasks nor proposals. The server returns a 15-minute signed
JWT containing the estimate, user/task identity, proposal UUID, algorithm version
and a task fingerprint. Its key is HMAC-derived from `JWT_SECRET_KEY` for a distinct
audience, so access tokens cannot be substituted. Tokens are signed, not encrypted;
they contain no historical task text. Rotating the secret invalidates previews.

Confirmation locks the owned task row, checks an existing decision before expiry
or staleness checks, and compares the complete request fingerprint. Identical
retries return the stored result, including after expiry; conflicting retries
return 409. The unique proposal primary key provides additional DB protection.
Expired new confirmations and changed tasks require a fresh preview. Explicit
dismissals can be recorded even if task content changed, but must be unexpired.

Accepted/changed confirmations update the task, insert the decision and invalidate
pending scheduling plans in one commit. Ignored only records the decision.
Existing generic task updates commit internally and are intentionally not called
inside this transaction. Shared AI telemetry has its own transaction and cannot
commit a task change.

## Setup and verification

Run the new Alembic migration before serving this code (including focus writes):

    cd backend/api
    python -m alembic upgrade head

Set `AI_ENABLED=true` and configure the existing Gemini key/model to enable priors;
the feature remains functional without Gemini. The user's AI assistant setting is
also honored. Never put keys in the frontend.

With a disposable PostgreSQL database configured:

    python -m pytest tests/test_duration_estimation_engine.py tests/test_duration_estimation_history.py tests/test_duration_estimation_api.py

Tests use `FakeAIProvider` and include real PostgreSQL concurrency, rollback,
ownership, baseline capture, stale/tampered tokens and duplicate confirmations.
The optional `scripts/check_duration_ui.py` uses Playwright against disposable
running API/web instances, exercises real requests, and creates synthetic data.
Install Playwright separately; it is not a production dependency.
