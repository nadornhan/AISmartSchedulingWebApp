# Demo verification and documentation consistency

Date: 2026-10-12 (Australia/Sydney). Source baseline: `54fdf02`, the three local cleanup commits on GitHub develop `3fb1d1d`.

This batch verifies the integrated web app and corrects outdated documentation. It does not refactor active feature code, change schema/infrastructure, implement React Native or configure mobile simulation tooling.

## Isolation and test method

- A separate PostgreSQL 16 container used RAM-only storage, bound to localhost port 55439, with synthetic users and tasks. All 32 existing migrations applied successfully to its current head.
- FastAPI ran on port 8002 with a separate audit virtual environment and upload directory. `AI_ENABLED=false` prevented external Gemini calls.
- A production frontend build passed with auth bypass disabled. Browser verification used the real JWT login flow, not a fake user.
- The in-app browser's initial cross-origin run lost its session. Direct JWT-authenticated `/auth/me` and CORS preflight requests passed. The cause of the browser failure was not established; the shared auth provider currently clears the session on any current-user request failure.
- Successful UI checks used a temporary same-origin proxy on port 3004, forwarding only to the isolated frontend/API. Its relative API URL was process/build-local; no proxy or API configuration was added to application source. This run does not prove that the original cross-origin browser issue is resolved.
- The existing demonstration checkout, live database and Docker services were not modified. The audit tab and three temporary servers were closed/stopped. The exact auto-removing audit container was stopped, removing only its disposable synthetic data. Reports and screenshot evidence remain outside the repository.

## Initial verification results

Backend suite: **516 passed, 1 failed**, 517 collected tests. Six dependency deprecation warnings were reported. This is not an entirely green suite.

Authenticated HTTP smoke checks: **37 passed**, covering registration/login, invalid-password and anonymous rejection, current user, folders/projects compatibility, scheduled task creation, subtask completion, edit/complete/reopen/duplicate/delete, second-user isolation, focus start/pause/resume/complete/history, settings save/reload, dashboard, analytics, notifications, scheduling plan, forest/profile/catalog and achievements.

Browser checks used mobile-width responsive web presentation:

| Area                  | Verified UI behaviour                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication        | Real sign-in, populated dashboard, sign-out, protected Tasks route redirected to login after sign-out. Registration was checked through HTTP, not the browser form.                            |
| Tasks/subtasks        | Manual task creation, priority/duration selection, subtask creation/completion, task editing, completion and reopening. Task deletion was verified through HTTP/tests, not a UI delete action. |
| Folders/inbox         | Folder creation, existing folder counts, inbox task assignment and cross-page display of the selected folder.                                                                                  |
| Calendar/priority     | Scheduled task visible in calendar; high/medium tasks and their folders visible on the priority board. Dragging/rescheduling was not exercised in the browser.                                 |
| Focus                 | Task selection, start, pause, resume and stop with recorded-session feedback. Completion endpoint/history passed through HTTP.                                                                 |
| Settings              | Pomodoro changed to 45 minutes and weekly-report preference enabled; both persisted after browser reload.                                                                                      |
| Analytics             | Current/previous-week panels and actual seeded focus metrics rendered; offline weekly-insight fallback rendered.                                                                               |
| Notifications/profile | Notification list/item interaction and signed-in identity/account details rendered. Avatar upload/delete UI was not exercised; backend avatar tests passed as part of the suite.               |
| Gamification/forest   | Plant catalog, Oak selection, achievement reward claim, 3D forest rendering, ground-click planting and planted-tree persistence after reload.                                                  |

These are main-flow smoke checks, not exhaustive browser regression coverage. Live Gemini generation, microphone input, external notification delivery, mobile native behaviour and production deployment were not tested.

## Findings from initial verification

The date-sensitive test and lint findings below are historical; see the quality-fix follow-up for their resolution. Session recovery is addressed in the auth follow-up below; the Pomodoro issue and the original cross-origin transport trigger remain open.

1. **Date-sensitive decomposition test:** `backend/api/tests/ai/test_task_decomposition.py` supplies a fixed `2026-10-01` deadline, then expects `TaskStatus.PENDING` at line 86. At this run's date, the response correctly exposes an overdue display status; `workflow_status` is a separate field. Review the fixture's clock/deadline or intended assertion instead of changing application overdue behaviour to make the test pass.
2. **Pomodoro API/UI range mismatch:** the API accepted and persisted 35 minutes during the smoke test, while the settings dropdown offers only 15, 20, 25, 30, 45 and 60. The browser showed the first option for that unsupported value. Saving/reloading a supported value (45) passed. Align the intended contract in a separate change.
3. **Existing frontend lint findings:** the previously recorded three errors remain in the untouched live code. They were not repaired as part of these two numbered tasks.
4. **Auth transport handling:** the cross-origin browser failure remains distinct from the successful same-origin run. The provider's broad session clearing deserves separate review; no auth behaviour was changed here.

## Documentation changes

README, STACK, CONTRIBUTING and the frontend guide now identify the current `(dashboard)` routes, public login/register pages, `lib/api.ts`, PostgreSQL-backed persistence, registered routers, folders/projects compatibility and unregistered scaffold packages. Setup commands use the project virtual environment and warn against overwriting configuration or testing against the shared demo database. Error-handling guidelines are distinguished from current implementation limitations.

The demonstration scope is web-only. React Native/Expo remains a future-work scaffold. Responsive viewport/touch simulation may be used for mobile presentation, but native-like presentation does not establish native feature support. No native wrapper, simulator or PWA/offline feature was implemented.

## Quality-fix follow-up (2026-10-12)

After the documentation commit `0da5ead`, a separate small batch resolved the test/lint findings without changing application deadline behaviour, UI markup, API contracts, schema or infrastructure:

- The decomposition fake response now defaults to a deadline relative to the current UTC date. The confirmation test covers both past and future deadlines and checks `workflow_status` independently from the overdue/pending display status.
- The 3D forest controls ref uses React's inferred `ComponentRef<typeof OrbitControls>` instead of `any`. Its transpiled JavaScript is identical to the baseline.
- Task creation no longer imports the unused voice button or binds the unused state setter. The existing state hook/value, highlight condition and all handlers remain unchanged; the voice component itself is retained.
- All JSX in both edited frontend components is byte-for-byte unchanged.

Verification: **518 backend tests passed**, including both deadline cases; six existing dependency deprecation warnings remain. Repository ESLint, web TypeScript, the production frontend build, targeted Python lint and whitespace checks passed. The suite ran only against a new RAM-backed PostgreSQL audit container using the unchanged migration history; that exact auto-removing container was stopped after verification.

Browser interaction checks were not repeated for this follow-up; the earlier browser evidence remains historical. Live AI, auth transport behaviour and the Pomodoro contract mismatch remain outside this batch. No changes were made to the demo database or the unrelated user-supplied image.

## Auth recovery follow-up (2026-10-12)

The current-user provider now shares a testable session coordinator for initial checks and refreshes. Transport errors, malformed responses, cancellation and server/permission errors preserve credentials and present a retryable unavailable state. Missing credentials, explicit sign-out and rejected credentials (`401`) still clear the session and redirect. Protected feature content is rendered only after a successful current-user check; a cached identity is not treated as verified auth.

New requests, unmount and sign-out invalidate older checks through request revisions and abort signals. Profile/avatar cache writes are guarded against sign-out, token replacement and cancelled requests; successful avatar updates retain their existing behaviour. Best-effort timezone synchronization does not decide authentication success. Existing local auth-bypass behaviour is retained for development, but was disabled for verification.

Verification: **33 auth regression tests passed**, using actual transpiled source modules with in-memory dependencies, without real credentials or network/database requests. Repository ESLint, web TypeScript and the production build passed. No new runtime/test dependencies were added. Use `corepack pnpm --filter @ai-smart-scheduling/web test:auth` to rerun the tests.

The computer-use workflow also verified the actual production React provider/shell against a localhost-only synthetic API fixture: a `503` blocked feature content and displayed **Try again**, retry with `200` recovered the profile without another login (the fixture received the retained Authorization header), and a subsequent `401` returned to login. This is a client error-recovery test, not a real JWT/backend integration run or proof that the original cross-origin failure is resolved. The temporary fixture and frontend servers were stopped; the demo database and services were not touched.

This auth batch does not change backend authorization, JWT storage keys, API contracts, CORS/security settings, database schema or normal feature layout/styles. Only the previously missing auth recovery/loading states are added. Pomodoro display/default behaviour remains unchanged. The separate user-supplied image remains untouched.

## Task refactoring browser follow-up (2026-10-13)

The current production frontend was tested through a localhost-only API fixture
with ten initial in-memory sample tasks. The fixture implements the Task API
responses needed for interaction checks; it is outside the repository. Auth
bypass was disabled, but the fixture's synthetic token is not a real JWT. These
checks do not repeat backend integration tests or exercise live Gemini output.

Desktop checks passed for pagination, priority filtering, sorting, row selection,
status changes, bulk completion, subtask expansion/completion and manual task
creation/editing. A created sample task was duplicated, rescheduled and deleted;
the corresponding UI refreshes and fixture mutations were observed. At a
390-pixel viewport, due-date grouping, filters/reset, complete-to-pending reopening,
editing, compact status changes, subtask toggling and pagination worked. A
1600-pixel desktop capture and a 390-pixel mobile capture were saved outside the
repository. No browser console errors were reported for the settled Task page.

Two existing limitations were observed and retained: priority filtering changes
the rows but the desktop footer uses status counts that do not include the
priority filter; the fixed desktop grid requires horizontal scrolling near a
1254-pixel viewport. Both follow the original page code/markup and are separate
from the extraction. Live AI entry, personalized duration estimates, schedule
locking and folder-move mutations were not tested in this fixture run.

The initial webpack development page did not hydrate in this browser/proxy setup;
the production build handled login and the Task interactions successfully. No
application source was changed to work around that test setup. The temporary
servers were stopped, browser viewport overrides reset and the test tab closed.

## Task footer-total fix (2026-10-14)

The footer now uses `total` from the filtered task-list response, matching the
rows and `total_pages`, instead of the broader status-tab count. Single-task
views report one result; empty results and failed requests clear the result
total. Status-tab badges keep their existing project/search scope. Regression
coverage checks priority-filter changes, clearing the filter, empty results and
failed refreshes. The desktop grid width remains a separate follow-up.

## Task desktop-width fix (2026-10-14)

Desktop rows below 1536 pixels now place the existing project/date and
priority/status fields on additional rows, with field labels and actions beside
the title. At 1536 pixels and above, the existing seven-column layout remains.
The mobile component and task handlers are unchanged.

With the production frontend and disposable local Task fixture, document and
Task-row scroll widths matched their available widths at 1024, 1254, 1440, 1600
and 390 pixels. Edit/menu controls stayed within the viewport, row selection and
status changes worked, and the edit dialog opened/closed. High-priority filtering
also displayed the corrected `1–5 of 5 tasks` footer. The 56 Task regression tests,
scoped lint and production build passed. No browser console errors were reported.
The temporary tab/servers were closed and viewport overrides reset. This is
frontend fixture verification, not a new backend or live AI integration run.

## Focus and auth styling follow-up (2026-10-14)

Focus now uses a reset icon and responsive timer/control sizing within a safe
area inside the circle. The requested 1.5 cm clearance is expressed in CSS units
(approximately 56.7 pixels); measured content clearance was at least 58 pixels
at viewport widths from 320 to 1600 pixels, without horizontal overflow. Long
break labels and a 120-minute timer were checked on the narrowest viewport.
Start, pause, reset, skip and session stop worked against the disposable fixture.
Timer state, effects and session handlers are unchanged.

The auth layout reference is applied to the form on the right, with compact
vertical spacing, centered headings, a full-width submit button and account-switch
link below the existing social controls. The original full-height mountain panel
is restored on the left, including its original logo, Chrono title and tagline.
The form headings are now `Sign in` and `Create account`.
Existing colours, font families, fields, checkboxes and submit handlers remain.
The earlier rounded input styling and accent-coloured buttons are retained.

The form layout was checked on the development server before restoring the left
mountain panel; navigation worked and both pages had no horizontal overflow at
390 pixels. The final mountain-panel restoration passed scoped lint; its production
build passed with the Task action extraction below. Earlier desktop previews are
historical and are saved outside the repository. These are frontend styling/fixture
checks, not real OAuth or backend integration tests. No database schema or
infrastructure changed.

## Task action extraction (2026-10-14)

`use-task-page-actions.ts` now owns Task mutation handlers and move/reschedule/busy
state. The page retains route/filter/selection state and its existing rendering.
`use-task-ai-entry.ts` now owns generation/decomposition previews, editable drafts,
confirmation requests and their feedback/busy state. The create/edit modal retains
manual fields, duration-estimate guards and its existing rendering.

All 18 extracted handler bodies and the page/form render markup match the previous
source, except the edit-dialog delete callback is now a named action with a null
guard. There are no new API endpoints, dependencies, schema or product behaviours.
The two extracted hooks are grouped with the existing Task components.

Verification: all 70 Task regression checks passed, including 14 action checks for
status rollback, last-row pagination, create/edit/delete failures, local end-of-day
rescheduling, schedule-lock validation, AI preview edits, mode reset, selected
subtask confirmation and retryable confirmation failures. Checks use in-memory
API doubles rather than live Gemini or the demonstration database. Scoped lint,
web TypeScript and the production build passed. Browser interaction checks were
not repeated for this extraction.
