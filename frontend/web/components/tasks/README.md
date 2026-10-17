# Task feature structure

- `task-page.tsx`: page orchestration, query parameters, filters, selection,
  dialogs, mutation handlers, grouping and pagination.
- `task-list-views.tsx`: desktop table and responsive mobile list, including
  selection, status controls, subtasks and action menus. Both receive state
  and callbacks from the page; filters, pagination, dialogs and API calls
  remain outside the views.
- `use-task-page-data.ts`: task/project loading, status counts, loading state,
  refresh callbacks and task/project data-change subscriptions. Errors remain
  shared with the page's mutation handlers; successful task refreshes still
  reset selection and the action menu.
- `task-page-model.ts`: page types, API/display mappings, filter/sort options,
  date and mobile-group labels, error messages and styling helpers.
- `task-page-controls.tsx`: status dropdown, selection checkbox and subtask
  accordion. These receive values and callbacks; page-level mutations remain
  in `task-page.tsx`.
- `create-task-modal.tsx`: existing create/edit forms and AI-assisted task
  flows. The page model continues using its existing priority-label helper.

The presentation extractions preserve the responsive web layout. The subsequent
loading optimisation adds `GET /tasks/counts` and a short-lived browser-memory
read cache without changing the database schema.

## Loading and navigation

Initial Tasks loading uses the task-list request, one aggregate counts request,
and the shared project-list request (three cold reads instead of seven). The
counts endpoint uses one aggregate SQL query and retains project/search scoping
and the existing computed-overdue rules. Count badges remain independent of the
priority filter, while pagination uses the filtered list response.

`lib/read-cache.ts` shares in-flight requests and reuses task lists/counts for
15 seconds and projects for 60 seconds. Recent snapshots remain available for up
to five minutes so a returning Tasks page can show content while revalidating.
The memory cache is limited to 50 query entries and clears on authentication
changes. It does not provide offline persistence or cross-tab synchronisation.
Task and project mutation events invalidate affected caches before notifying
mounted views. Calls with an AbortSignal remain independent requests so cancelling
one view cannot cancel another view's shared request. Request revisions prevent
old filter results or unmounted loaders from changing the current Tasks view.

Folders remain available. Project choices are shared and no longer reloaded for
every search query; they are still loaded on a cold visit because Tasks uses them
for its existing folder controls and edit/create forms.

Run Task regression tests from `frontend/web`:

```sh
node --test tests/tasks/task-page.test.mjs tests/tasks/task-page-data.test.mjs tests/tasks/task-actions.test.mjs tests/tasks/task-read-cache.test.mjs
```

The tests cover display/workflow status separation, priorities, date labels,
mobile grouping, filter defaults, extracted controls, query loading, request
failures, refresh subscriptions and cleanup. The data tests use a deterministic
hook runner rather than a DOM renderer. They use the
existing TypeScript and React dependencies with Node's built-in test runner.
They do not replace a live end-to-end demonstration check.

## Refactoring checkpoints

- Extracted display helpers and small controls with regression coverage.
- Extracted data loading and subscriptions with refresh/cleanup tests.
- Extracted the desktop table with selection and action-menu tests.
- Extracted the mobile list with grouping and task-control tests.
- Browser checks completed on 2026-10-13 with the production frontend and a
  localhost API fixture containing disposable tasks. Desktop creation,
  editing, duplication, rescheduling, deletion, selection, bulk completion,
  priority filtering, sorting and pagination worked. At 390 pixels, grouping,
  filters, reopening, editing, status changes, subtasks and pagination worked.
  This verifies frontend interactions rather than real backend/JWT integration
  or live AI output. See `frontend/DEMO_VERIFICATION.md` for the limits and
  existing issues observed.

Each extraction is a separate verification checkpoint. The desktop and mobile
views share one presentation module to reduce unnecessary file separation.
