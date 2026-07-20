# Todo List

Todo list and smart scheduling web app with task tracking, folders, deadlines, focus mode, priority views, analytics, and gamification.

## Stack

- Monorepo: pnpm workspaces
- Web: Next.js App Router, React, TypeScript, Tailwind CSS
- API: Python, FastAPI
- Database: PostgreSQL 16 with SQLAlchemy 2 and Alembic migrations
- Auth: FastAPI-managed JWT with PostgreSQL-backed users
- Container: Docker Compose

See [STACK.md](STACK.md) for architecture and stack decisions.

## Current Development Scope

Start with frontend screens and FastAPI endpoints. A deployed database and Docker setup are not required for the first development pass.

Use this scope first:

```text
Frontend pages/components
Frontend API helpers
FastAPI routers/schemas/services
Temporary in-memory data or mock data
```

The PostgreSQL, SQLAlchemy, Alembic, and Docker foundation is available. Feature branches may integrate it after their endpoint shapes and feature flows are stable.

## Repository Structure

```text
frontend/
  web/       Next.js web app
  mobile/    Expo mobile scaffold
backend/
  api/       FastAPI backend
packages/
  shared/    Shared TypeScript types and constants
supabase/    Optional Supabase SQL notes/migrations if Supabase Auth is used
```

Feature code should stay in matching folders:

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

## Branch Strategy

Use feature branches, not member branches.

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

- `main`: stable milestone/demo-ready code only.
- `develop`: integration branch for active work.
- `feature/*`: focused feature branches created from `develop`.

Merge completed feature branches into `develop`. Merge `develop` into `main` only for stable milestones.

## Team Ownership

Six members can own multiple feature branches. The branch name should describe the feature, not the person.

| Member | Branches                                                              | Primary folders                                                                                                                                                                             |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `feature/navigation-shell`, `feature/settings-polish`                 | `frontend/web/components/layout`, `frontend/web/app/settings`, `frontend/web/components/settings`, `backend/api/app/settings`                                                               |
| 2      | `feature/auth-account`                                                | `frontend/web/app/auth`, `frontend/web/components/auth`, `frontend/web/lib/auth.ts`, `backend/api/app/auth`                                                                                 |
| 3      | `feature/task-management`                                             | `frontend/web/app/tasks`, `frontend/web/components/tasks`, `frontend/web/lib/tasks.ts`, `backend/api/app/tasks`                                                                             |
| 4      | `feature/folders-inbox`                                               | `frontend/web/app/folders`, `frontend/web/components/folders`, `frontend/web/lib/folders.ts`, `backend/api/app/folders`                                                                     |
| 5      | `feature/calendar-reminders`, `feature/analytics-dashboard`           | `frontend/web/app/calendar`, `frontend/web/app/analytics`, `frontend/web/components/calendar`, `frontend/web/components/analytics`, `backend/api/app/calendar`, `backend/api/app/analytics` |
| 6      | `feature/focus-mode`, `feature/priority-view`, `feature/gamification` | `frontend/web/app/focus`, `frontend/web/app/priority`, `frontend/web/app/gamification`, `backend/api/app/focus`, `backend/api/app/priority`, `backend/api/app/gamification`                 |

Search and filtering should be implemented inside the relevant feature branch, usually `feature/task-management` for task search or `feature/folders-inbox` for folder/inbox filtering. Create a separate `feature/search-filtering` branch only if the team decides that work is large enough to split.

## Requirements

- Node.js 22+
- Python 3.12+
- Docker Desktop for the local PostgreSQL workflow
- Corepack enabled
- PostgreSQL 16 for persistent application data and custom authentication

## Setup

```powershell
corepack enable
corepack pnpm install
python -m venv backend/api/.venv
backend/api/.venv/Scripts/python -m pip install -e backend/api
```

Copy environment examples as needed:

```powershell
Copy-Item .env.example .env
Copy-Item frontend/web/.env.example frontend/web/.env
Copy-Item backend/api/.env.example backend/api/.env
```

## Database Setup

The backend uses PostgreSQL 16, SQLAlchemy 2, psycopg, and Alembic.

Create the backend environment file:

```powershell
Copy-Item backend/api/.env.example backend/api/.env
```

Start PostgreSQL:

```powershell
docker compose up -d postgres
docker compose ps
```

The local backend connects through:

```text
postgresql+psycopg://smart_scheduler:smart_scheduler_dev@localhost:5433/smart_scheduling
```

When the API runs inside Docker Compose, it connects to the `postgres` service on port `5432`.

Check the current migration state:

```powershell
cd backend/api
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic check
```

Apply all migrations:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Create a migration after adding or changing SQLAlchemy models:

```powershell
.\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "describe schema change"
```

Review every generated migration before applying or committing it. Do not use `Base.metadata.create_all()` as the production migration workflow.

Database models should inherit from the shared `app.database.Base`. Request handlers should receive sessions through `Depends(get_db)`.

User-owned tables should use a non-null UUID `user_id` foreign key referencing `users.id` with `ON DELETE CASCADE`. Protected endpoints must derive the current user ID from the validated JWT `sub` claim rather than accepting `user_id` from request bodies or query parameters.

## Run Locally

```powershell
corepack pnpm dev:web
corepack pnpm dev:api
```

Containerized stack:

```powershell
docker compose up --build
```

Expected local URLs:

```text
Web: http://localhost:3000
API: http://localhost:8000
```

## Development Workflow

Start from latest `develop`:

```bash
git checkout develop
git pull
git checkout -b feature/task-management
```

Work mostly inside the folders owned by the feature branch. Shared files such as `frontend/web/app/layout.tsx`, `backend/api/app/main.py`, global CSS, and shared types should stay small and be changed carefully.

During early development, members may build frontend screens and FastAPI endpoints without a deployed database. Temporary in-memory data or local SQLite is acceptable if endpoint contracts stay stable and can later be backed by PostgreSQL.

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
