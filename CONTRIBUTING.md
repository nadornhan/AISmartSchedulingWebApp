# Contributing To Todo List

This project is a pnpm monorepo with a Next.js web app, FastAPI backend, PostgreSQL database, SQLAlchemy ORM, Supabase Auth, and an Expo mobile scaffold. The active task-management implementation is currently web plus API; mobile task features are not implemented yet. Keep contributions aligned with the stack and architecture described in `STACK.md`.

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

- `feature/navigation-shell`
- `feature/auth-account`
- `feature/task-management`
- `feature/folders-inbox`
- `feature/calendar-reminders`
- `feature/priority-view`
- `feature/focus-mode`
- `feature/analytics-dashboard`
- `feature/gamification`
- `feature/settings-polish`

## Repository Structure

```text
frontend/
  web/       Next.js web app and active task-management UI
  mobile/    Expo scaffold; mobile task features are not implemented yet
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
- `packages/shared`: shared TypeScript types/constants used across frontend packages.
- `packages/supabase`: shared Supabase client setup.
- `frontend/mobile`: scaffold only until mobile task features are intentionally added.

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
Copy-Item frontend/mobile/.env.example frontend/mobile/.env
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
- Keep shared TypeScript types in workspace packages when both web and mobile need them.
- Treat `frontend/mobile` as scaffolded until mobile task screens and API integration are added.
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
