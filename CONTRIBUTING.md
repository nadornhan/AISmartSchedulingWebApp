# Contributing To Todo List

This project is a pnpm monorepo with a Next.js web app, FastAPI backend, PostgreSQL database, SQLAlchemy ORM, and Supabase Auth. The active task-management implementation is web plus API. Keep contributions aligned with the stack and architecture described in `STACK.md`.

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

## Planned Feature Branches

Keep feature branches focused on one feature area. Six members can own multiple branches when needed.

| Member | Branches | Frontend Ownership | Backend Ownership |
| --- | --- | --- | --- |
| 1 | `feature/navigation-shell`, `feature/settings-polish` | App layout, sidebar, route placeholders, responsive shell, settings UI polish | Database management, base router structure, health/status cleanup, user preference routes later |
| 2 | `feature/auth-account` | Login/register/sign-out UI, account page, Supabase session state | Supabase JWT verification, current-user dependency, profile/account endpoints |
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
  supabase/  Shared Supabase client factory
STACK.md     Stack, architecture, and stack decision reasoning
supabase/    Supabase migration notes and SQL
```

Use this ownership model during feature work:

- `frontend/web`: pages, React components, frontend state, styling, and API client helpers.
- `backend/api`: FastAPI routes, request/response schemas, SQLAlchemy models, database sessions, and backend auth checks.
- `packages/shared`: shared TypeScript types/constants used by the web app.
- `packages/supabase`: shared Supabase client setup.

## Feature Development Workflow

Each feature branch should produce a usable vertical slice when possible.

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

- Treat Supabase as the authentication provider.
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
