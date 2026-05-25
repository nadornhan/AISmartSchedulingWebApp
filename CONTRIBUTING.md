# Contributing To Todo List

This project uses a feature-branch workflow. Six members can each own one or more feature branches, but branches should be named by feature, not by member.

## Branch Rules

- `main` is stable milestone/demo-ready code.
- `develop` is the integration branch for active work.
- `feature/*` branches are for focused feature work.
- Start all feature work from latest `develop`.
- Merge completed feature branches back into `develop`.
- Merge `develop` into `main` only after the milestone is stable.

```bash
git checkout develop
git pull
git checkout -b feature/task-management
```

## Current Feature Branches

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

Do not create member branches such as `feature/minh-work` or `andy-branch`. Assign members to feature branches instead.

## Six-Member Ownership Plan

| Member | Branches | Frontend ownership | Backend ownership |
| --- | --- | --- | --- |
| 1 | `feature/navigation-shell`, `feature/settings-polish` | Layout shell, sidebar, route placeholders, responsive navigation, settings UI | Base app wiring, health/status cleanup, settings/preferences endpoints |
| 2 | `feature/auth-account` | Login, register, sign out, account/profile UI, auth session state | Auth routes, password hashing or Supabase token verification, current-user dependency |
| 3 | `feature/task-management` | Task list, task cards, task form, complete/reopen, edit/delete | Task schemas, task service, task CRUD endpoints, user-owned task filtering |
| 4 | `feature/folders-inbox` | Folder list, inbox view, folder form, move tasks between folders, folder filters | Folder schemas, folder service, folder CRUD, task folder support |
| 5 | `feature/calendar-reminders`, `feature/analytics-dashboard` | Calendar view, due dates, reminders, overdue/upcoming views, analytics dashboard | Deadline/reminder fields, reminder endpoints, analytics summary endpoints |
| 6 | `feature/focus-mode`, `feature/priority-view`, `feature/gamification` | Pomodoro/focus UI, priority labels/views, streak/tree progress UI | Focus sessions, priority fields/endpoints, gamification progress endpoints |

Search and filtering should live inside the feature that owns the screen. Task search belongs with `feature/task-management`; folder/inbox filtering belongs with `feature/folders-inbox`. Only create `feature/search-filtering` if the team intentionally splits that work.

## Folder Rules

Keep feature work inside matching frontend and backend folders.

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

Use files this way:

- `app/<feature>/page.tsx`: route entry point.
- `components/<feature>/`: reusable UI for that feature.
- `lib/<feature>.ts`: frontend API helper functions.
- `router.py`: FastAPI endpoints.
- `models.py`: database models when persistence is added.
- `schemas.py`: request and response schemas.
- `service.py`: business logic and storage/query code.

Shared files should mostly connect feature modules together:

- `frontend/web/app/layout.tsx`: root layout only.
- `frontend/web/app/globals.css`: global styling only.
- `backend/api/app/main.py`: app setup and `include_router(...)` calls.
- `packages/shared/src`: shared TypeScript contracts used by multiple features.

## Feature Folder Map

```text
frontend/web/
  app/
    auth/
    tasks/
    folders/
    calendar/
    analytics/
    focus/
    priority/
    gamification/
    settings/
  components/
    layout/
    auth/
    tasks/
    folders/
    calendar/
    analytics/
    focus/
    priority/
    gamification/
    settings/
  lib/
    auth.ts
    tasks.ts
    folders.ts
    calendar.ts
    analytics.ts
    focus.ts
    priority.ts
    gamification.ts
    settings.ts

backend/api/app/
  auth/
  tasks/
  folders/
  calendar/
  analytics/
  focus/
  priority/
  gamification/
  settings/
```

## Development Order

For each feature:

1. Define the endpoint contract and any shared types.
2. Add backend schemas/routes/services.
3. Add frontend API helpers.
4. Build the UI.
5. Run checks before merging.

During early frontend and endpoint work, a real deployed database is not required. In-memory data or local SQLite can be used temporarily, but keep endpoint shapes stable so PostgreSQL can replace the temporary storage later.

## Setup

```powershell
corepack enable
corepack pnpm install
python -m venv backend/api/.venv
backend/api/.venv/Scripts/python -m pip install -e backend/api
```

```powershell
Copy-Item .env.example .env
Copy-Item frontend/web/.env.example frontend/web/.env
Copy-Item backend/api/.env.example backend/api/.env
```

## Run Locally

```powershell
corepack pnpm dev:web
corepack pnpm dev:api
```

## Quality Checks

Before merging:

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

## Commit Messages

Use short, descriptive commit messages:

- `feat: add sidebar navigation`
- `feat: add task CRUD endpoints`
- `feat: add calendar reminder view`
- `fix: correct active sidebar state`
- `refactor: split task service`
- `docs: update branch workflow`

## Documentation

Update docs when a change affects setup, environment variables, data storage, auth flow, API contracts, branch strategy, or folder ownership.
