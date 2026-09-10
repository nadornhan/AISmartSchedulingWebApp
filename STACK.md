# Todo List Stack

This document explains the intended stack and how the frontend, API, storage, and feature folders should fit together.

## Current Stack

| Area              | Technology                                          | Purpose                                                                                        |
| ----------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Monorepo          | pnpm workspaces                                     | Manage web, mobile, backend, and shared packages in one repository.                            |
| Web app           | Next.js App Router, React, TypeScript, Tailwind CSS | Browser-based task and scheduling UI.                                                          |
| Mobile scaffold   | Expo, React Native                                  | Optional mobile app scaffold.                                                                  |
| API               | Python, FastAPI                                     | HTTP endpoints for auth, tasks, folders, scheduling, focus, analytics, and gamification.       |
| Database          | PostgreSQL 16, SQLAlchemy 2, Alembic                | Persistent application data, ORM models, sessions, and schema migrations.                      |
| Temporary storage | In-memory data or local SQLite                      | Acceptable for isolated frontend or endpoint work before a feature integrates with PostgreSQL. |
| Auth              | FastAPI-managed JWT with PostgreSQL-backed users    | Registration, login, token issuance, and current-user loading.                                 |
| Containers        | Docker Compose                                      | Local service orchestration when needed.                                                       |
| Shared code       | TypeScript workspace packages                       | Shared constants and frontend/backend API contracts.                                           |

## Architecture Overview

The target production data path is:

```text
Next.js web app
  -> FastAPI backend
  -> service layer
  -> PostgreSQL
```

During early development, the backend may temporarily use:

```text
Next.js web app
  -> FastAPI backend
  -> in-memory data or local SQLite
```

That is acceptable as long as the frontend talks to stable API endpoints and does not depend on the temporary storage implementation.

## Current Development Scope

The first development pass should focus on usable frontend screens and FastAPI endpoint contracts.

In scope now:

- Next.js pages and reusable components.
- Frontend API helper files in `frontend/web/lib`.
- FastAPI routers, schemas, and services.
- Temporary in-memory data, local SQLite, or frontend mock data.

The shared PostgreSQL, SQLAlchemy, Alembic, and Docker foundation is available for feature integration.

Still out of scope until feature flows stabilize:

- Production-hosted PostgreSQL deployment.
- Production secret management and connection pooling.
- Production authentication hardening.

Feature members may still use temporary storage for isolated work, but persistent feature data should use the shared SQLAlchemy engine, session dependency, declarative base, and Alembic workflow.

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
supabase/    Optional Supabase SQL notes/migrations if Supabase Auth is used
```

## Feature Modules

Use feature modules so six members can work in parallel with fewer conflicts.

```text
frontend/web/app/<feature>/page.tsx
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

`layout` is frontend-only and lives under `frontend/web/components/layout`.

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
- `models.py`: database models once persistence is added.

Early endpoints may use in-memory data in `service.py`. Later, the service can be changed to PostgreSQL without changing the frontend API calls.

## Frontend Design

The web app should use route folders for pages and component folders for reusable UI:

```text
frontend/web/app/tasks/page.tsx
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

| Branch                        | Main folders                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature/navigation-shell`    | `frontend/web/components/layout`, shared route shell files                                                                                  |
| `feature/auth-account`        | `frontend/web/app/auth`, `frontend/web/components/auth`, `frontend/web/lib/auth.ts`, `backend/api/app/auth`                                 |
| `feature/task-management`     | `frontend/web/app/tasks`, `frontend/web/components/tasks`, `frontend/web/lib/tasks.ts`, `backend/api/app/tasks`                             |
| `feature/folders-inbox`       | `frontend/web/app/folders`, `frontend/web/components/folders`, `frontend/web/lib/folders.ts`, `backend/api/app/folders`                     |
| `feature/calendar-reminders`  | `frontend/web/app/calendar`, `frontend/web/components/calendar`, `frontend/web/lib/calendar.ts`, `backend/api/app/calendar`                 |
| `feature/priority-view`       | `frontend/web/app/priority`, `frontend/web/components/priority`, `frontend/web/lib/priority.ts`, `backend/api/app/priority`                 |
| `feature/focus-mode`          | `frontend/web/app/focus`, `frontend/web/components/focus`, `frontend/web/lib/focus.ts`, `backend/api/app/focus`                             |
| `feature/analytics-dashboard` | `frontend/web/app/analytics`, `frontend/web/components/analytics`, `frontend/web/lib/analytics.ts`, `backend/api/app/analytics`             |
| `feature/gamification`        | `frontend/web/app/gamification`, `frontend/web/components/gamification`, `frontend/web/lib/gamification.ts`, `backend/api/app/gamification` |
| `feature/settings-polish`     | `frontend/web/app/settings`, `frontend/web/components/settings`, `frontend/web/lib/settings.ts`, `backend/api/app/settings`                 |

## Data Storage Plan

Early development can use temporary storage:

- In-memory lists/dictionaries for quick endpoint work.
- Local SQLite if local persistence is useful.
- Mock data in the frontend only for isolated UI work.

Final integration should use PostgreSQL through the FastAPI backend. Avoid building a second permanent task-storage path directly from the frontend to Supabase or another database.

## Recommended Improvements

1. Implement PostgreSQL-backed registration, login, password hashing, and JWT validation.
2. Add feature-owned SQLAlchemy models and reviewed Alembic migrations.
3. Replace temporary feature storage with SQLAlchemy service queries.
4. Add backend API tests for task CRUD, auth failures, and user data isolation.
5. Add shared TypeScript types for request/response contracts used by multiple features.
6. Keep `main.py`, root layout, and global CSS small to reduce conflicts.

## Quality Checks

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm format:check
```

For backend changes:

```powershell
backend/api/.venv/Scripts/python -m ruff check backend/api
```
