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

## Results

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

## Findings retained for separate fixes

1. **Date-sensitive decomposition test:** `backend/api/tests/test_task_decomposition.py` supplies a fixed `2026-10-01` deadline, then expects `TaskStatus.PENDING` at line 86. At this run's date, the response correctly exposes an overdue display status; `workflow_status` is a separate field. Review the fixture's clock/deadline or intended assertion instead of changing application overdue behaviour to make the test pass.
2. **Pomodoro API/UI range mismatch:** the API accepted and persisted 35 minutes during the smoke test, while the settings dropdown offers only 15, 20, 25, 30, 45 and 60. The browser showed the first option for that unsupported value. Saving/reloading a supported value (45) passed. Align the intended contract in a separate change.
3. **Existing frontend lint findings:** the previously recorded three errors remain in the untouched live code. They were not repaired as part of these two numbered tasks.
4. **Auth transport handling:** the cross-origin browser failure remains distinct from the successful same-origin run. The provider's broad session clearing deserves separate review; no auth behaviour was changed here.

## Documentation changes

README, STACK, CONTRIBUTING and the frontend guide now identify the current `(dashboard)` routes, public login/register pages, `lib/api.ts`, PostgreSQL-backed persistence, registered routers, folders/projects compatibility and unregistered scaffold packages. Setup commands use the project virtual environment and warn against overwriting configuration or testing against the shared demo database. Error-handling guidelines are distinguished from current implementation limitations.

The demonstration scope is web-only. React Native/Expo remains a future-work scaffold. Responsive viewport/touch simulation may be used for mobile presentation, but native-like presentation does not establish native feature support. No native wrapper, simulator or PWA/offline feature was implemented.
