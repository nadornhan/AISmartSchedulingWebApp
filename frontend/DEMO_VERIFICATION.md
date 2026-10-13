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

1. **Date-sensitive decomposition test:** `backend/api/tests/test_task_decomposition.py` supplies a fixed `2026-10-01` deadline, then expects `TaskStatus.PENDING` at line 86. At this run's date, the response correctly exposes an overdue display status; `workflow_status` is a separate field. Review the fixture's clock/deadline or intended assertion instead of changing application overdue behaviour to make the test pass.
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
