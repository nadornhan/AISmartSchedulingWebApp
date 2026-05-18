# Todo List

Todo list app with task tracking, categories, deadlines, Pomodoro focus mode, and tree planting gamification.

## Stack

- Monorepo: pnpm workspaces
- Web: Next.js App Router, React, TypeScript, Tailwind CSS
- API: Python, FastAPI, SQLAlchemy
- Database: PostgreSQL
- Auth: Supabase Auth
- Container: Docker Compose
- Mobile: Expo React Native scaffold only; task features are not implemented yet

For a more detailed explanation of the stack, data flow, improvement roadmap, and stack decision reasoning, see [STACK.md](STACK.md).

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

Development should follow this split:

- Frontend UI work goes in `frontend/web`.
- Backend API and database work goes in `backend/api`.
- Shared frontend contracts go in `packages/shared`.
- Supabase is used for authentication; task data is stored through FastAPI, SQLAlchemy, and PostgreSQL.

## Requirements

- Node.js 22+
- Python 3.12+
- Docker Desktop
- Corepack enabled
- Supabase project for auth

## Setup

```powershell
corepack enable
corepack pnpm install
python -m venv backend/api/.venv
backend/api/.venv/Scripts/python -m pip install -e backend/api
```

Copy the environment examples and fill in your Supabase project values. `SUPABASE_JWT_SECRET` is required by the API so it can verify Supabase access tokens.

```powershell
Copy-Item .env.example .env
Copy-Item frontend/web/.env.example frontend/web/.env
Copy-Item backend/api/.env.example backend/api/.env
Copy-Item frontend/mobile/.env.example frontend/mobile/.env
```

## Run Locally

```powershell
corepack pnpm dev:web
corepack pnpm dev:api
```

Run the whole containerized stack:

```powershell
docker compose up --build
```

The web app runs on `http://localhost:3000`, the API on `http://localhost:8000`, and PostgreSQL on `localhost:5432`.

The Expo mobile app is currently a scaffold/foundation screen. It is not part of the active task-management implementation yet.

## Development Workflow

Start feature work from `develop`:

```bash
git checkout develop
git pull
git checkout -b feature/task-management
```

Build features as vertical slices when possible:

```text
frontend/web     UI, pages, components, and API client helpers
backend/api      routes, schemas, models, services, and auth checks
packages/shared  shared TypeScript types when frontend/backend contracts change
```

Merge finished feature branches back into `develop`. Keep `main` for stable milestone-ready code.

## Team Feature Split

Each branch should stay focused on one feature area. Six members can own multiple branches when needed.

| Member | Branches | Frontend Work | Backend Work |
| --- | --- | --- | --- |
| 1 | `feature/navigation-shell`, `feature/settings-polish` | App layout, sidebar, route placeholders, responsive shell, settings UI polish | Base router structure, health/status cleanup, user preference routes later |
| 2 | `feature/auth-account` | Login/register/sign-out UI, account page, Supabase session state | Supabase JWT verification, current-user dependency, profile/account endpoints |
| 3 | `feature/task-management` | Task cards, task form, task list, complete/reopen, edit/delete UI | Task model, task schemas, task CRUD routes, user-owned task filtering |
| 4 | `feature/search-filtering`, `feature/folders-inbox` | Search input, filters, folder list, folder form, inbox view, move tasks between folders | Task search query support, folder model, folder schemas, folder CRUD routes, task folder support |
| 5 | `feature/calendar-reminders`, `feature/priority-view` | Calendar view, due date UI, reminder UI, overdue/upcoming views, priority labels | Due date fields, reminder fields, priority field, deadline queries, priority update/query routes |
| 6 | `feature/focus-mode`, `feature/analytics-dashboard`, `feature/gamification` | Pomodoro timer, focus page, analytics dashboard, streak/tree UI | Focus session model/routes, analytics summary endpoint, streak/tree progress model/routes |

## Quality Checks

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm format:check
```

## Supabase

Supabase remains the auth provider. The frontend signs users in with Supabase email links and sends the Supabase access token to FastAPI. Task data now lives in the app PostgreSQL database through SQLAlchemy.
