# CHRONO AI feature delivery plan

## Shared baseline

All AI feature branches start from the commit that introduces this document.
The shared baseline consists of:

1. `app.ai.AIService` as the only gateway to Gemini.
2. `app.ai.policies` as the registry of feature names and prompt versions.
3. `app.ai.routing` as the parser-versus-Gemini decision contract.
4. `app.ai.contracts` as the versioned scoring context and preview contract.
5. `app.scoring` and `app.scheduling` as deterministic authorities.

Feature code must not instantiate the Gemini SDK, duplicate the 0.75 parser
threshold, calculate score totals with Gemini, or write an AI preview directly to
the database.

## Standard flow

```text
User action
  -> deterministic parser / PostgreSQL aggregate / scoring engine
  -> backend builds ai-context-v1
  -> AIService returns a strict Pydantic response
  -> backend validates the proposal and returns preview
  -> user edits, accepts, or rejects
  -> separate confirmation endpoint writes atomically
```

For rescheduling, the scheduling engine must create and validate every option
before Gemini receives it. Gemini only explains trade-offs. For weekly insights,
SQL/Python calculates every metric and Gemini only writes the narrative.

## Six-member work split

### Member 1 — AI platform and integration

- Own `backend/api/app/ai/` and review additions to the policy registry.
- Maintain Gemini configuration, structured responses, quota/fallback handling,
  telemetry, prompt/context versions, and fake-provider test utilities.
- Publish integration examples and ensure feature PRs use `AIService`.
- Review cross-feature contract changes; do not own feature UI.

Deliverable: stable shared contracts, integration tests, and a short operational
guide for free-tier quota and failures.

### Member 2 — Smart task input and decomposition

- Own the hybrid natural-language task flow in `tasks`.
- Extend the current parser so it reports `succeeded`, `confidence`, missing fields,
  and multiple-intent detection.
- Call `decide_task_understanding_route`; use Gemini only when it returns
  `use_ai=true` or when decomposition is explicitly requested.
- Return editable task/subtask previews. Save only selected subtasks in one
  transaction after confirmation.

Suggested endpoints:

- `POST /tasks/ai/preview`
- `POST /tasks/ai/decompose`
- `POST /tasks/ai/confirm`

### Member 3 — Personalized duration estimation

- Own duration history queries across tasks and focus sessions.
- Calculate actual-versus-estimated ratios and sample size in SQL/Python.
- Use Gemini only for the cold-start prior; combine that prior with personal
  history deterministically.
- Return estimate, confidence, sample count, adjustment factor, and explanation.
- Record whether the user accepted or edited the suggestion for later evaluation.

Suggested endpoints:

- `POST /tasks/{task_id}/duration/preview`
- `POST /tasks/{task_id}/duration/confirm`

### Member 4 — Intelligent rescheduling

- Own affected-task detection, locked-block rules, option generation, validation,
  apply, and undo in `scheduling`/`calendar`.
- Reuse `SchedulingProfileV7`, capacity windows, constraint validation, and
  candidate score evidence. Do not create a second scoring engine.
- Produce two or three valid deterministic options; Gemini explains only the
  supplied options.
- Apply one option only after explicit confirmation and store enough data to undo
  it atomically.

Suggested endpoints:

- `POST /scheduling/reschedule/preview`
- `POST /scheduling/reschedule/{proposal_id}/apply`
- `POST /scheduling/reschedule/{proposal_id}/undo`

### Member 5 — Voice input and priority suggestion

- Implement browser/device SpeechRecognition and show transcript preview; do not
  upload raw audio in the MVP.
- Send the confirmed transcript through the same smart task input contract owned
  by Member 2.
- Build priority preview from deadline, user importance, workload, dependencies,
  and the deterministic task score breakdown.
- Never silently change user priority; expose accept/change/ignore actions.

Suggested endpoints:

- Reuse `POST /tasks/ai/preview` for transcripts.
- `POST /tasks/{task_id}/priority/preview`
- `POST /tasks/{task_id}/priority/confirm`

### Member 6 — Weekly AI insights and evaluation

- Own weekly metric aggregation and AI narrative generation in `analytics`.
- Calculate completion rate, focus duration, workload, streaks, estimate error,
  and trends in SQL/Python.
- Generate at most one cached narrative per user per week; page refresh must not
  call Gemini again.
- Add quality/cost reporting by feature using existing AI metadata without logging
  prompt contents or personal task text.

Suggested endpoint:

- `GET /analytics/weekly-ai-insight`

## Dependency order

1. Merge this shared foundation.
2. Members branch from the updated `develop`.
3. Member 2 publishes parser assessment and task preview shapes early.
4. Members 3 and 5 integrate with those task contracts.
5. Member 4 builds deterministic rescheduling before adding Gemini explanations.
6. Member 6 builds database aggregates before adding the weekly narrative.
7. Member 1 reviews policy/contract use and runs the cross-feature integration
   suite before the milestone merge.

## Definition of done for every AI feature

- Uses a registered feature and prompt version.
- Uses strict Pydantic input/output schemas and `FakeAIProvider` in tests.
- Has a deterministic fallback or a clear, sanitized unavailable response.
- Sends only the minimum user-owned data needed for the request.
- Shows source/confidence/reason where relevant.
- Does not mutate user data before confirmation, except read-only weekly narrative
  caching.
- Revalidates deadlines, overlaps, ownership, and current database state at apply
  time.
- Prevents duplicate apply/reward/write operations with an idempotent transaction.
- Includes unit tests, API tests, and at least one failure/fallback test.
- Documents any change to a shared contract before another member depends on it.
