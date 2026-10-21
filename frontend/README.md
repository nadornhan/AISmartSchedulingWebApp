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

The development command now uses Turbopack rather than forcing Webpack. Restart
an existing dev server to pick up this command change. If a bundler-specific
problem occurs, use `corepack pnpm --filter @ai-smart-scheduling/web dev:webpack
--port 3002` as a fallback (on one line). Development still compiles routes on
demand; a first visit can be slower than a repeat visit.

For a demonstration without on-demand development compilation, stop the dev
server, then run:

```powershell
corepack pnpm --filter @ai-smart-scheduling/web build
corepack pnpm --filter @ai-smart-scheduling/web start --port 3002
```

Build and start must use the same public API configuration. Authentication still
requires the API. The session gate now withholds sidebar, header/notification,
XP and protected feature loaders until the session is verified; the production
router also prefetches `/login` without blocking verification. This does not
turn local-storage tokens into server-side authentication or eliminate a cold
development route compile.

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

The `(dashboard)` route group does not appear in URLs. Its pages include `/`, `/tasks`, `/folders`, `/calendar`, `/priority`, `/focus`, `/analytics`, `/notifications`, `/profile`, `/account`, `/gamification` and `/gamification/forest`. Account Settings replaces the removed `/settings` route. Keep the shared route layout; feature pages should not duplicate it.

Calendar uses `lib/tasks.ts`, `lib/projects.ts` and the shared task-creation modal. Scheduling recommendations use `lib/scheduling.ts`. Priority uses `lib/tasks.ts` and `lib/projects.ts`. These features do not require empty `calendar.ts` or `priority.ts` modules.

Within `web/components/calendar`, `calendar-page.tsx` owns navigation and view
selection, `calendar-model.ts` owns date/task mapping helpers, `calendar-views.tsx`
contains the existing responsive views and reschedule dialog, and
`use-calendar-tasks.ts` owns API loading, refresh subscriptions and task actions.

Within `web/components/focus`, `FocusMode.tsx` renders the timer, task picker and
settings modal. `use-focus-timer.ts` owns the countdown, local timer persistence,
active-session restoration, task selection and focus-session requests.
`use-focus-tasks.ts` loads the active-task choices and deep-link fallback.

Account Settings (`components/profile/account-page.tsx`) provides Account, Notifications, Theme, Work preferences and Scheduling priorities sections. Desktop uses navigation beside the selected content, with Log out beneath the left navigation. Mobile uses a centered avatar/name/email header and flat grouped rows with subtle section-label bands, while retaining compact row spacing and section gaps. Private information and progress precede the inline Preferences list; Log out is the last item below the list. Open rows use an accent indicator and slide transition, with reduced-motion support. Settings persistence uses `lib/settings.ts` and the backend settings API; theme choice uses `UiPreferencesProvider` and browser storage. The Account view links to Profile, AI Insights and Personal Forest.

The Profile page uses a two-column desktop layout: photo and editable names on the left, with read-only account information and account access stacked on the right. The camera icon opens image upload and Save changes spans the name form. The columns stack on mobile. Password changes, two-step verification and account deletion are not implemented by this layout.

## Interface design documentation

Task navigation now uses `GET /tasks/counts` instead of five separate count
requests. Task lists/counts and project choices use a bounded, authentication-scoped
memory cache with shared in-flight requests. Recent task snapshots display on
return visits while expired reads refresh. Mutation events invalidate affected
entries before triggering view refreshes, and sign-out clears the cache. See the
[task loading guide](web/components/tasks/README.md#loading-and-navigation) for
lifetimes, request counts and verification scope. The updated frontend requires
the backend version that provides `/tasks/counts`; no migration is needed.

[Frontend Architecture and Integration Design](Frontend_Architecture_and_Integration_Design.docx) contains Chapter 6 Frontend and UI UX Design for insertion into the final report. It compares the current interface with the A4 prototype, describes the less is more approach, light mode, authentication, dashboard, Tasks and Calendar, Account Settings and Profile, and leaves labelled screenshot placeholders. Existing architecture and integration sections remain part of the chapter. See [Theme.md](Theme.md) for visual conventions; `web/app/globals.css` is the implementation source for theme tokens.

[Data Fetching and Performance Review](Chrono_Data_Fetching_and_Performance_Review.docx)
explains the implemented before/after request flow, aggregate counts, browser
cache policy, mutation and authentication boundaries, verification limits and
prioritised performance proposals. The architecture chapter reflects the current
cache module; proposed calendar, shell, database and query-library changes are
not described as implemented features.

Mobile navigation exposes Home, Tasks, central task creation, Calendar and Account. Desktop retains the wider feature sidebar. Dark and light workspace themes share semantic tokens; authentication artwork currently remains dark. Google and Facebook buttons on authentication pages are visual mock-ups.

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
