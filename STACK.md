# Todo List Stack

This document describes the integrated develop branch and how the frontend, API, storage, and feature folders should fit together.

## Current Stack

| Area            | Technology                                          | Purpose                                                                                  |
| --------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Monorepo        | pnpm workspaces                                     | Manage web, mobile, backend, and shared packages in one repository.                      |
| Web app         | Next.js App Router, React, TypeScript, Tailwind CSS | Browser-based task and scheduling UI.                                                    |
| Mobile scaffold | Expo, React Native                                  | Optional mobile app scaffold.                                                            |
| API             | Python, FastAPI                                     | HTTP endpoints for auth, tasks, folders, scheduling, focus, analytics, and gamification. |
| Database        | PostgreSQL 16, SQLAlchemy 2, Alembic                | Persistent application data, ORM models, sessions, and schema migrations.                |
| Auth            | FastAPI-managed JWT with PostgreSQL-backed users    | Registration, login, token issuance, and current-user loading.                           |
| Containers      | Docker Compose                                      | Local service orchestration when needed.                                                 |
| Shared code     | TypeScript workspace packages                       | Reserved shared TypeScript package; currently an empty export.                           |

## Architecture Overview

The implemented application data path is:

```text
Next.js web app
  -> FastAPI backend
  -> service layer
  -> PostgreSQL
```

The frontend uses `frontend/web/lib/api.ts` for requests and JWT headers, then feature API helpers. Protected routes obtain the current user through the shared auth provider. Server data is persisted through SQLAlchemy and Alembic-managed PostgreSQL tables; browser caches and UI preferences do not replace server persistence.

## Current Development Scope

The integrated demo includes auth/profile, tasks/subtasks, projects/folders, dashboard, calendar and priority views, scheduling, focus sessions, analytics, notifications, settings and gamification/forest. Authenticated integration requires a working PostgreSQL database and the existing migrations.

Production hosting, secret management and security hardening remain separate deployment work. Mobile and shared TypeScript packages remain scaffolds. React Native/Expo is not part of the current demonstration.

Mobile demonstration means the responsive Next.js web app, optionally using viewport/touch simulation or separately reviewed native-like presentation tooling. Do not treat simulation as validation of native integrations, background behaviour or push notifications. No native wrapper, PWA/offline enhancement or emulation tooling was implemented in this documentation batch.

## Authentication Architecture

The team uses PostgreSQL-backed custom authentication managed by FastAPI:

```text
Frontend login/register
  -> FastAPI auth endpoints
  -> users table in PostgreSQL
  -> backend issues JWT
  -> frontend sends Bearer token
  -> backend validates JWT and reads the user UUID from the sub claim
```

The auth feature owns the `users` model, password hashing, login and registration routes, JWT creation and validation, and the `get_current_user` dependency.

User IDs use UUID. User-owned database tables should define a non-null UUID `user_id` foreign key referencing `users.id` with `ON DELETE CASCADE`.

Protected endpoints must derive `user_id` from the validated JWT `sub` claim. They must not trust a `user_id` supplied through request bodies, path parameters, or query parameters for ownership checks.

## Repository Layout

```text
frontend/
  web/       Next.js web app
  mobile/    Expo mobile scaffold
backend/
  api/       FastAPI backend
packages/
  shared/    Shared TypeScript constants and types
supabase/    Historical/optional SQL notes; not the active auth/storage path
```

## Feature Modules

Use feature modules so six members can work in parallel with fewer conflicts.

```text
frontend/web/app/(dashboard)/<feature>/page.tsx
frontend/web/components/<feature>/
frontend/web/lib/<feature>.ts

backend/api/app/<feature>/
  router.py
  models.py
  schemas.py
  service.py
```

Current feature areas:

```text
auth
tasks
folders
calendar
analytics
focus
priority
gamification
settings
layout
```

`layout` is frontend-only and lives under `frontend/web/components/layout`. Public auth pages are `/login` and `/register`; the authenticated route group is `app/(dashboard)`. `/auth` is currently a retained null route, not the login screen.

Registered backend modules include `auth`, `projects`, `folders`, `tasks` (including nested AI helpers), `notifications`, `settings`, `analytics`, `ai`, `scheduling`, `focus`, `dashboard` and `gamification`. The `/folders` API delegates to project services/models. Unregistered calendar/priority source scaffolds were removed; live priority routes are registered from `tasks/priority_router.py`. Calendar UI reads task/project data rather than a standalone calendar API.

Feature modules use additional files when they have a distinct responsibility.
Analytics calculations live in `analytics/metrics.py`; scheduling query/validation
and response helpers in `scheduling/plan_helpers.py`; gamification profile queries,
unlock checks and response mapping in `gamification/read_model.py`. Existing
`service.py` entry points coordinate the API operations and transactions.
The feature-folder example above does not require empty models/services files.

## Backend Design

The backend should keep `main.py` small:

```python
from fastapi import FastAPI

from app.tasks.router import router as tasks_router

app = FastAPI(title="CSIT321 AI Smart Scheduling API")
app.include_router(tasks_router)
```

Each feature should keep endpoint logic split by responsibility:

- `router.py`: FastAPI route definitions.
- `schemas.py`: Pydantic request/response models.
- `service.py`: business logic and storage access.
- `models.py`: current SQLAlchemy database models.

Existing services use SQLAlchemy and PostgreSQL. Keep API contracts and ownership checks stable during cleanup; do not introduce a second permanent storage path.

## Frontend Design

The web app should use route folders for pages and component folders for reusable UI:

```text
frontend/web/app/(dashboard)/tasks/page.tsx
frontend/web/components/tasks/
frontend/web/lib/tasks.ts
```

`lib/<feature>.ts` should contain API calls to FastAPI. Components should not hard-code backend URLs or storage logic.

## Branch And Folder Ownership

The project uses feature branches:

```text
main
`-- develop
    |-- feature/navigation-shell
    |-- feature/auth-account
    |-- feature/task-management
    |-- feature/folders-inbox
    |-- feature/calendar-reminders
    |-- feature/priority-view
    |-- feature/focus-mode
    |-- feature/analytics-dashboard
    |-- feature/gamification
    `-- feature/settings-polish
```

The branch-to-folder mapping is:

| Branch                        | Main folders                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature/navigation-shell`    | `frontend/web/components/layout`, shared route shell files                                                                                                                                    |
| `feature/auth-account`        | `frontend/web/app/login`, `frontend/web/app/register`, `frontend/web/app/(dashboard)/profile`, `frontend/web/components/auth`, `frontend/web/lib/auth.ts`, `backend/api/app/auth`             |
| `feature/task-management`     | `frontend/web/app/(dashboard)/tasks`, `frontend/web/components/tasks`, `frontend/web/lib/tasks.ts`, `backend/api/app/tasks`                                                                   |
| `feature/folders-inbox`       | `frontend/web/app/(dashboard)/folders`, `frontend/web/components/folders`, `frontend/web/lib/folders.ts`, `backend/api/app/folders`                                                           |
| `feature/calendar-reminders`  | `frontend/web/app/(dashboard)/calendar`, `frontend/web/components/calendar`, `frontend/web/lib/tasks.ts`, `frontend/web/lib/projects.ts`, `backend/api/app/tasks`, `backend/api/app/projects` |
| `feature/priority-view`       | `frontend/web/app/(dashboard)/priority`, `frontend/web/components/priority`, `frontend/web/lib/tasks.ts`, `frontend/web/lib/projects.ts`, `backend/api/app/tasks`, `backend/api/app/projects` |
| `feature/focus-mode`          | `frontend/web/app/(dashboard)/focus`, `frontend/web/components/focus`, `frontend/web/lib/focus.ts`, `backend/api/app/focus`                                                                   |
| `feature/analytics-dashboard` | `frontend/web/app/(dashboard)/analytics`, `frontend/web/components/analytics`, `frontend/web/lib/analytics.ts`, `backend/api/app/analytics`                                                   |
| `feature/gamification`        | `frontend/web/app/(dashboard)/gamification`, `frontend/web/components/gamification`, `frontend/web/lib/gamification.ts`, `backend/api/app/gamification`                                       |
| `feature/settings-polish`     | `frontend/web/app/(dashboard)/settings`, `frontend/web/components/settings`, `frontend/web/lib/settings.ts`, `backend/api/app/settings`                                                       |

## Data Storage

Persistent data uses PostgreSQL through FastAPI's shared SQLAlchemy engine, session dependency and declarative base. Apply the existing Alembic migration history before exercising features. Never run tests or migration experiments against the shared demo database.

Keep both `/folders` and `/projects` compatibility APIs. Supabase files are optional historical notes, not the active auth/storage path. Browser-local settings from the earlier checkout must not replace the current settings API.

## Refactoring status and follow-up work

Task, Calendar and Focus extraction, backend service separation, unused dependency
removal and documentation reconciliation are complete. Verification details live
in `frontend/DEMO_VERIFICATION.md`; historical cleanup decisions and current status
live in `frontend/AUDIT.md`.

Remaining product/integration findings are the Pomodoro settings/API range mismatch
and the original cross-origin auth transport trigger. Live Gemini verification and
production deployment are separate work. Shared contracts should move into
`packages/shared` only when there is a real consumer.

## Quality Checks

```powershell
corepack pnpm lint
corepack pnpm --filter @ai-smart-scheduling/web typecheck
corepack pnpm build
corepack pnpm format:check
```

For backend changes:

```powershell
backend/api/.venv/Scripts/python -m ruff check backend/api
```
