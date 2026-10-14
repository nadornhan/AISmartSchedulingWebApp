# Frontend guide

This guide describes the current `develop` web demonstration and its completed
cleanup/refactoring batches. The web app includes all demonstrated feature routes.

## Run the web app

From the repository root:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @ai-smart-scheduling/web dev --port 3002
```

Port 3002 avoids conflicts if another checkout occupies port 3001. Use any free port. Set `NEXT_PUBLIC_API_URL` in `frontend/web/.env.local` to the running FastAPI server, using `.env.example` as a reference. Run the backend against its configured PostgreSQL database and existing Alembic migrations for authenticated feature demonstrations; starting the frontend alone does not start the API.

`NEXT_PUBLIC_BYPASS_AUTH=true` supplies a UI-only fake user. It does not grant backend access and is not an integration test.

## Code map

| Responsibility                                | Location                                                   |
| --------------------------------------------- | ---------------------------------------------------------- |
| Login and registration                        | `web/app/login`, `web/app/register`, `web/components/auth` |
| Dashboard and feature route entries           | `web/app/(dashboard)`                                      |
| Shared authenticated shell and UI preferences | `web/components/layout`                                    |
| Feature UI                                    | `web/components/<feature>`                                 |
| Shared requests, errors and JWT storage       | `web/lib/api.ts`                                           |
| Feature API contracts and helpers             | `web/lib/*.ts`                                             |
| Runtime images, models and sounds             | `web/public`                                               |

The `(dashboard)` route group does not appear in URLs. Its pages include `/`, `/tasks`, `/folders`, `/calendar`, `/priority`, `/focus`, `/analytics`, `/notifications`, `/profile`, `/settings`, `/gamification` and `/gamification/forest`. Keep the shared route layout; feature pages should not duplicate it.

Calendar uses `lib/tasks.ts`, `lib/projects.ts` and the shared task-creation modal. Scheduling recommendations use `lib/scheduling.ts`. Priority uses `lib/tasks.ts` and `lib/projects.ts`. These features do not require empty `calendar.ts` or `priority.ts` modules.

Within `web/components/calendar`, `calendar-page.tsx` owns navigation and view
selection, `calendar-model.ts` owns date/task mapping helpers, `calendar-views.tsx`
contains the existing responsive views and reschedule dialog, and
`use-calendar-tasks.ts` owns API loading, refresh subscriptions and task actions.

Within `web/components/focus`, `FocusMode.tsx` renders the timer, task picker and
settings modal. `use-focus-timer.ts` owns the countdown, local timer persistence,
active-session restoration, task selection and focus-session requests.
`use-focus-tasks.ts` loads the active-task choices and deep-link fallback.

Settings persistence is implemented through `lib/settings.ts` and the backend settings API. UI preferences and auth caches have their existing browser-storage responsibilities; do not replace server-backed settings with the earlier local-only implementation.

`mobile/` is an Expo scaffold and `packages/shared/` is a shared workspace scaffold. Both remain declared workspaces and are retained.

## Demonstration scope

The demo is the Next.js web app; React Native/Expo is deferred. Use the existing responsive web navigation/layout for mobile-sized presentation. Viewport/touch simulation and possible native-like presentation tools are separate from a native implementation and do not prove background execution, push delivery, offline support or device-specific integrations. No mobile simulator, native wrapper or PWA feature was added in this batch.

## Verification

```powershell
corepack pnpm --filter @ai-smart-scheduling/web typecheck
corepack pnpm --filter @ai-smart-scheduling/web test:auth
corepack pnpm --filter @ai-smart-scheduling/web test:calendar
corepack pnpm --filter @ai-smart-scheduling/web test:focus
corepack pnpm exec eslint frontend/web
corepack pnpm --filter @ai-smart-scheduling/web build
```

`test:auth` runs targeted session-recovery and stale-response regressions using Node's built-in test runner and the existing TypeScript dependency. It makes no real API/database requests. Broader feature UI coverage remains manual; type checking and building do not replace authenticated browser testing of the demonstrated features.

`test:calendar` checks date boundaries, paginated loading, refresh cleanup, failure
handling, schedule locks and rescheduling payloads with in-memory API doubles.
Its tests are grouped in `web/tests/calendar`.

`test:focus` checks countdown/session accounting, persistence and restoration,
completion and save failures, duration changes and task choices using a simulated
clock, local storage and in-memory API doubles. Its tests are grouped in
`web/tests/focus`.

See [AUDIT.md](AUDIT.md) for the cleanup scope and preservation decisions.

See [DEMO_VERIFICATION.md](DEMO_VERIFICATION.md) for authenticated browser/API verification and known limitations.
