# Priority suggestions

`POST /tasks/priority/preview` previews a draft. It accepts title, due_date,
estimated_duration_minutes, current_priority, importance_level,
importance_description, dependency_ids and include_ai_explanation. Dates must
include a timezone. Client-provided scores are rejected.

`POST /tasks/{task_id}/priority/preview` uses the saved task's facts and the
importance/dependency inputs above. Both routes are authenticated. They do not
write task data. Optional AI usage telemetry remains handled by AIService.

`POST /tasks/{task_id}/priority/confirm` accepts confirmation_token,
expected_updated_at, action (`accept` or `change`) and selected_priority.
Accept must match the signed proposal. Change represents an explicit user choice.
The signed token expires after 15 minutes and is bound to the user, task and task
version. Confirmation locks the task row and invalidates pending scheduling plans
in the same transaction. Stale or repeated confirmations return 409 without
another write. Ignore requires no request.

The task form uses draft preview so unsaved edits are included. Accept/Change
updates only form state; the existing Create/Save action persists that choice.
Changing form evidence invalidates the displayed suggestion and pending response.

Rules live in app.scoring.priority. Existing capacity-aware scoring supplies
deadline evidence; existing priority factors are not fed back into the proposed
tier. Confidence is evidence coverage, not a calibrated probability. Workload is
all open estimated task minutes divided by working minutes in the next seven
days; unknown durations use the scheduling engine's existing duration fallback.

Gemini receives ai-context-v1 through AIService under priority-suggestion-v3.
Reasons use one short, conversational sentence about practical impact, in the
task's language, without repeating the title or inventing consequences.
One request assesses importance from title, description and optional impact notes.
It returns nullable importance, confidence and an evidence-based reason; the backend
still computes final priority. Invalid responses and provider errors leave importance
unknown and fall back to remaining deterministic evidence. No raw audio is accepted.

Dependency IDs are ownership-checked prerequisites for this preview only. The
current model does not persist dependency relationships or expose reverse
dependents, so dependency evidence is marked incomplete. The UI no longer preselects
importance. Explicit importance_level remains supported for API callers and takes
precedence over AI inference. AI confidence is self-reported, distinct from evidence
coverage. No database migration is included.

Validation without external model calls:

    python -m unittest discover -s tests -p test_priority_endpoints_unittest.py -v

Additional rule cases are in test_priority_rules.py for environments with pytest.
