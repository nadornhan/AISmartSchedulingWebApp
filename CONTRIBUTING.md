# Contributing To Todo List

This project is a pnpm monorepo with a Next.js web app, backend API, PostgreSQL database, SQLAlchemy ORM where Python services are used, and either PostgreSQL-backed custom auth or Supabase Auth. The active task-management implementation is web plus API. Keep contributions aligned with the stack and architecture described in `STACK.md`.

## Branches

Permanent branches:

- `main` is the stable branch for milestone-ready code.
- `develop` is the integration branch for active work.

Feature work should start from `develop`:

```bash
git checkout develop
git pull
git checkout -b feature/task-management
```

Merge completed feature branches back into `develop` first. Only merge `develop` into `main` after a stable milestone.

## Branch Structure

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

## Planned Feature Branches

Keep feature branches focused on one feature area. Six members can own multiple branches when needed.

| Member | Branches | Frontend Ownership | Backend Ownership |
| --- | --- | --- | --- |
| 1 | `feature/navigation-shell`, `feature/settings-polish` | App layout, sidebar, route placeholders, responsive shell, settings UI polish | Database management, base router structure, health/status cleanup, user preference routes later |
| 2 | `feature/auth-account` | Login/register/sign-out UI, account page, auth session state, Node.js rewrite | PostgreSQL-backed auth or Supabase token verification, current-user dependency, profile/account endpoints in Node.js |
| 3 | `feature/task-management` | Task cards, task form, task list, complete/reopen, edit/delete UI | Task model, task schemas, task CRUD routes, user-owned task filtering |
| 4 | `feature/search-filtering`, `feature/folders-inbox` | Search input, filters, folder list, folder form, inbox view, move tasks between folders | Task search query support, folder model, folder schemas, folder CRUD routes, task folder support |
| 5 | `feature/calendar-reminders`, `feature/analytics-dashboard` | Calendar view, due date UI, reminder UI, overdue/upcoming views, analytics dashboard | Due date fields, reminder fields, deadline queries, analytics summary endpoint |
| 6 | `feature/focus-mode`, `feature/priority-view`, `feature/gamification` | Pomodoro timer, focus page, priority labels, streak/tree UI | Focus session model/routes, priority field, priority update/query routes, streak/tree progress model/routes |

## Repository Structure

```text
frontend/
  web/       Next.js web app and active task-management UI
backend/
  api/       FastAPI backend, SQLAlchemy models, schemas, auth, and task routes
packages/
  shared/    Shared TypeScript types and constants
  supabase/  Optional shared Supabase client factory if Supabase Auth is used
STACK.md     Stack, architecture, and stack decision reasoning
supabase/    Optional Supabase migration notes and SQL
```

Use this ownership model during feature work:

- `frontend/web`: pages, React components, frontend state, styling, and API client helpers.
- `backend/api`: FastAPI routes, request/response schemas, SQLAlchemy models, database sessions, and backend auth checks.
- `packages/shared`: shared TypeScript types/constants used by the web app.
- `packages/supabase`: optional shared Supabase client setup if Supabase Auth is used.

## Feature Development Workflow

Each feature branch should produce a usable vertical slice when possible.

Each member should work in feature-owned folders for both frontend and backend work. Avoid putting full feature logic directly into shared files such as `frontend/web/app/page.tsx`, `backend/api/app/main.py`, `backend/api/app/models.py`, or `backend/api/app/schemas.py`. Shared files should usually only register routes, export types, or connect feature modules together.

Backend feature folders should follow this pattern:

```text
backend/api/app/
  tasks/
    router.py
    models.py
    schemas.py
    service.py
  folders/
    router.py
    models.py
    schemas.py
    service.py
  focus/
    router.py
    models.py
    schemas.py
    service.py
  analytics/
    router.py
    schemas.py
    service.py
```

Use backend files this way:

- `router.py`: FastAPI endpoints for the feature.
- `models.py`: SQLAlchemy models owned by the feature.
- `schemas.py`: Pydantic request and response schemas.
- `service.py`: business logic and database queries.
- `main.py`: only app setup and `app.include_router(...)` calls.

Frontend feature folders should follow this pattern:

```text
frontend/web/
  app/
    tasks/
    folders/
    focus/
    analytics/
    settings/
  components/
    layout/
    tasks/
    folders/
    focus/
    analytics/
    settings/
  lib/
    tasks.ts
    folders.ts
    focus.ts
    analytics.ts
    settings.ts
```

Use frontend files this way:

- `app/<feature>/page.tsx`: route entry point for that feature.
- `components/<feature>/`: reusable UI components for the feature.
- `lib/<feature>.ts`: API client helpers for that feature.
- `components/layout/`: shared navigation and shell components.
- `packages/shared/src`: only shared TypeScript contracts that multiple features need.

Example task feature split:

```text
frontend/web/app/...          task page or route
frontend/web/components/...   task UI components
frontend/web/lib/...          task API client helper
backend/api/app/...           task route, schema, model, or service
packages/shared/src/...       shared task contract, if needed
```

Task search belongs in `feature/search-filtering`. The backend should support query parameters such as `search`, `status`, and later `folder_id`; the frontend should expose search input and filtering controls without duplicating backend authorization logic.

Recommended order for feature changes:

1. Define or update shared types if the contract changes.
2. Add or update backend models, schemas, and routes.
3. Add or update frontend API helpers.
4. Build the UI for the feature.
5. Run quality checks before merging.

Avoid large shared-file edits unless the feature needs them. If several branches need the same shared contract, coordinate that change through `develop` first.

## Development Setup

Install dependencies:

```powershell
corepack enable
corepack pnpm install
python -m venv backend/api/.venv
backend/api/.venv/Scripts/python -m pip install -e backend/api
```

Copy environment files:

```powershell
Copy-Item .env.example .env
Copy-Item frontend/web/.env.example frontend/web/.env
Copy-Item backend/api/.env.example backend/api/.env
```

Run locally:

```powershell
corepack pnpm dev:web
corepack pnpm dev:api
```

Run the container stack:

```powershell
docker compose up --build
```

## Quality Checks

Run these before opening or merging changes:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm format:check
```

If backend dev dependencies are installed, also run Python checks when changing `backend/api`:

```powershell
backend/api/.venv/Scripts/python -m ruff check backend/api
```

## Commit Messages

Use short, descriptive commit messages:

- `feat: add sidebar navigation`
- `feat: add inbox task capture`
- `feat: add pomodoro timer view`
- `fix: correct active sidebar state`
- `style: polish focus mode layout`
- `refactor: split task card component`
- `docs: update stack documentation`

## Architecture Guidelines

- Authentication can be PostgreSQL-backed custom auth or Supabase Auth. The `feature/auth-account` branch owns this implementation.
- Store task data through the FastAPI backend, SQLAlchemy, and PostgreSQL.
- Keep frontend API calls behind small client helper functions.
- Keep shared TypeScript types in workspace packages when web contracts need them.
- Avoid adding a second task-storage path unless the architecture is intentionally changed and documented.
- Prefer feature branches that deliver a usable vertical slice across UI, API contract, backend, tests, and docs when applicable.

## Documentation

Update documentation when a change affects:

- Setup commands.
- Environment variables.
- Data storage.
- Authentication flow.
- API routes or request/response contracts.
- Branch strategy or development workflow.

Use `README.md` for project entry-point information and `STACK.md` for stack and architecture details.
