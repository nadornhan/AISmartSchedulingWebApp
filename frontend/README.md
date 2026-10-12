# Frontend guide

This guide describes GitHub `develop` at `3fb1d1d` and the subsequent unused-file cleanup. The web app is implemented; it is not a settings-only scaffold.

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

Settings persistence is implemented through `lib/settings.ts` and the backend settings API. UI preferences and auth caches have their existing browser-storage responsibilities; do not replace server-backed settings with the earlier local-only implementation.

`mobile/` is an Expo scaffold and `packages/shared/` is a shared workspace scaffold. Both remain declared workspaces and are retained.

## Demonstration scope

The demo is the Next.js web app; React Native/Expo is deferred. Use the existing responsive web navigation/layout for mobile-sized presentation. Viewport/touch simulation and possible native-like presentation tools are separate from a native implementation and do not prove background execution, push delivery, offline support or device-specific integrations. No mobile simulator, native wrapper or PWA feature was added in this batch.

## Verification

```powershell
corepack pnpm --filter @ai-smart-scheduling/web typecheck
corepack pnpm exec eslint frontend/web
corepack pnpm --filter @ai-smart-scheduling/web build
```

There is currently no frontend test script. Type checking and building do not replace authenticated browser testing of task creation/editing, scheduling, focus, settings, profile and the other demonstrated features.

See [AUDIT.md](AUDIT.md) for the cleanup scope and preservation decisions.

See [DEMO_VERIFICATION.md](DEMO_VERIFICATION.md) for authenticated browser/API verification and known limitations.
