# Todo List Stack

This document explains the current technical stack, how the main parts of the system fit together, why this stack was chosen, and which areas should be improved as the project grows.

## Current Stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Monorepo | pnpm workspaces | Manages web, backend, shared packages, and the mobile scaffold in one repository. |
| Web app | Next.js App Router, React, TypeScript, Tailwind CSS | Browser-based task management UI. |
| Mobile app | Expo React Native, TypeScript | Scaffold only. Mobile task features are not implemented yet. |
| API | Python, FastAPI | Backend HTTP API for authenticated task operations. |
| ORM | SQLAlchemy | Maps Python models to PostgreSQL tables and handles database queries. |
| Database | PostgreSQL | Primary storage for app task data. |
| Authentication | Supabase Auth | User sign-in and access token issuing. |
| Containers | Docker Compose | Local container setup for PostgreSQL, API, and web app. |
| Shared code | TypeScript workspace packages | Shared app constants, task types, and Supabase client creation. |

## Architecture Overview

The active task data path is:

```text
Next.js web app
  -> FastAPI backend
  -> SQLAlchemy ORM
  -> PostgreSQL tasks table
```

Supabase is used for authentication:

```text
User signs in with Supabase Auth
  -> Supabase returns an access token
  -> Frontend sends the token to FastAPI
  -> FastAPI validates the token
  -> API uses the token subject as the current user id
```

This keeps account authentication managed by Supabase while application task data remains under the app backend's control.

The active application today is the web app plus FastAPI backend. The Expo mobile app exists as a foundation, but it does not yet provide task management screens or task CRUD.

## Repository Layout

```text
frontend/
  web/       Next.js web app
  mobile/    Expo React Native scaffold
backend/
  api/       FastAPI backend
packages/
  shared/    Shared TypeScript constants and task types
  supabase/  Shared Supabase client factory
supabase/
  migrations/ Supabase SQL migrations currently used for auth/profile-related planning
```

## Backend

The backend lives in `backend/api`.

Important files:

- `backend/api/app/main.py` defines the FastAPI app and task CRUD routes.
- `backend/api/app/models.py` defines SQLAlchemy ORM models.
- `backend/api/app/database.py` configures the database engine and sessions.
- `backend/api/app/auth.py` validates Supabase bearer tokens.
- `backend/api/pyproject.toml` declares Python dependencies.

The API currently supports:

- `GET /health`
- `GET /tasks`
- `POST /tasks`
- `PATCH /tasks/{task_id}`
- `DELETE /tasks/{task_id}`

Task search should be added to the task API instead of becoming a separate storage path. A typical endpoint shape is:

```text
GET /tasks?search=exam&status=active&folder_id=...
```

The API should keep filtering scoped to the authenticated user.

## Frontend

The web app lives in `frontend/web`.

Important files:

- `frontend/web/app/page.tsx` contains the current task UI and Supabase sign-in flow.
- `frontend/web/lib/tasks.ts` contains the browser API client for task CRUD.
- `frontend/web/lib/supabase.ts` creates the browser Supabase client when environment values are present.

Task search UI should live with task management screens and components. The frontend can collect search/filter input, but backend routes should still enforce user ownership and return only authorized task rows.

The mobile scaffold lives in `frontend/mobile`.

Important files:

- `frontend/mobile/App.tsx` contains the current mobile foundation screen.
- `frontend/mobile/src/supabase.ts` creates the mobile Supabase client when environment values are present.

The mobile app is currently scaffolded but does not yet implement task CRUD or the main productivity workflows.

## Why Not Supabase Only

A Supabase-only app would be simpler:

```text
Next.js
  -> Supabase Auth
  -> Supabase Postgres
```

That can work for an MVP. However, this project includes planned features that can become easier to organize with a dedicated backend:

- task management rules
- task search, filtering, and sorting
- folders and inbox behavior
- deadlines and reminders
- Pomodoro/focus session tracking
- productivity analytics
- streaks and tree growth
- future AI prioritization
- future scheduled jobs or notification workflows

Using FastAPI gives the team one backend place to put business rules instead of spreading logic across frontend components, database policies, SQL functions, and client-side code.

## Why FastAPI

FastAPI is useful here because it gives the project:

- explicit API routes such as `GET /tasks`, `POST /tasks`, and `PATCH /tasks/{task_id}`
- request and response validation through Pydantic schemas
- dependency injection for auth and database sessions
- clean integration with Python tooling
- a natural place for future service logic

The frontend does not need to know database details. It calls the API, and the API decides how to validate, authorize, store, and return data.

## Why SQLAlchemy ORM

SQLAlchemy is the backend's database mapping layer. It lets the backend represent database tables as Python classes.

Example:

```python
task = Task(
    user_id=current_user.id,
    title=payload.title,
    description=payload.description,
)

db.add(task)
db.commit()
```

Without an ORM, the backend would need raw SQL in many places:

```sql
insert into tasks (user_id, title, description)
values (...);
```

Raw SQL is sometimes useful, but using it everywhere can become repetitive and harder to maintain as the schema grows.

SQLAlchemy helps because it:

- keeps table definitions in one organized Python layer
- makes CRUD operations easier to read and update
- maps database rows into Python objects
- reduces repeated hand-written SQL
- supports relationships between models
- works well with PostgreSQL
- can pair with Alembic migrations later

SQLAlchemy is also useful for search and filtering because task queries can be composed safely in Python as filters are added, for example by title, status, folder, due date, or priority.

For this project, SQLAlchemy models can eventually represent:

```text
Task
Folder
Reminder
FocusSession
UserPreference
ProductivityStat
Streak
TreeProgress
Achievement
```

That matters because the app is not only a simple task list. The planned features create relationships between tasks, time, focus sessions, stats, and gamification records.

## SQLAlchemy Model vs Pydantic Schema

The backend uses two different kinds of data objects:

```text
SQLAlchemy model  -> database table/row representation
Pydantic schema   -> API request/response representation
```

For example:

- `Task` model: how a task is stored in PostgreSQL
- `TaskCreate` schema: what the frontend may send when creating a task
- `TaskRead` schema: what the API returns to the frontend

This separation is useful because the API should not expose every database detail directly.

## Data Storage

Task data is stored in PostgreSQL through the FastAPI backend and SQLAlchemy.

Supabase should be treated as the auth provider unless the architecture is intentionally changed later. The repository currently contains a Supabase migration with a `tasks` table, but the active application flow uses the app PostgreSQL database through SQLAlchemy for task storage. This should be clarified or cleaned up before the schema becomes more complex.

## Supabase's Role

In this stack, Supabase is used for authentication.

Flow:

```text
User signs in with Supabase Auth
  -> frontend receives a Supabase access token
  -> frontend sends the token to FastAPI
  -> FastAPI verifies the token
  -> FastAPI uses the token subject as the current user id
  -> task data is stored in PostgreSQL through SQLAlchemy
```

Supabase is not the active task-storage layer in this architecture. Task data belongs to the app backend and database.

## Environment Variables

Root and app-specific `.env.example` files document the required local environment values.

Key values:

- `DATABASE_URL` connects the API to PostgreSQL.
- `SUPABASE_JWT_SECRET` lets FastAPI verify Supabase access tokens.
- `BACKEND_CORS_ORIGINS` controls which web origins can call the API.
- `NEXT_PUBLIC_API_URL` points the web app to FastAPI.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` configure web auth.
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` configure mobile auth.

## When This Stack Is Worth It

This stack is worth keeping if the project wants:

- clear parallel frontend and backend development
- backend API design practice
- database modeling practice
- centralized business logic
- easier future support for scheduled jobs, analytics, and AI features
- less direct coupling between frontend components and database tables

It is also a good fit if different teammates will own different areas:

```text
frontend/web     UI and client behavior
backend/api      API routes, auth checks, database logic
packages/shared  shared TypeScript types
```

Member 1 owns database management for the team, including coordinating schema decisions, SQLAlchemy model changes, database setup notes, and migration planning.

## Tradeoffs

The cost of this stack is extra setup and more moving parts:

- FastAPI backend must be maintained
- SQLAlchemy models must stay aligned with the database
- migrations should be added before schema changes become frequent
- frontend and backend contracts need coordination

For a very small app, Supabase-only would be faster. For this project, the current stack gives more structure for a team building multiple features in parallel.

## Quality Checks

Current repo-level checks:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm format:check
```

The current codebase does not yet include automated tests.

## Recommended Improvements

1. Add database migrations with Alembic.

   The backend currently creates tables from SQLAlchemy metadata at startup. That is convenient early in development, but schema changes should move to explicit migrations before the app grows.

2. Clarify Supabase database usage.

   Keep Supabase as auth-only, or intentionally move data storage to Supabase. The current preferred architecture is Supabase Auth plus app-owned PostgreSQL through FastAPI and SQLAlchemy.

3. Split backend code by feature.

   Move toward separate route, model, schema, and service files for tasks, folders, focus sessions, analytics, and settings.

4. Add backend API tests.

   Start with task CRUD, authentication failures, and user data isolation.

5. Add shared API client code.

   The web app has task API helpers. Mobile should eventually use the same backend contract, ideally through a shared package.

6. Add task search and filtering in `feature/search-filtering`.

   Start with task title/description search scoped to the current user. Later filters can include status, folder, due date, priority, overdue state, and completion state.

7. Plan background work.

   Reminders, notification scheduling, streaks, and analytics may eventually need background jobs or scheduled workers.

8. Review Supabase JWT verification.

   The current implementation verifies bearer tokens with `SUPABASE_JWT_SECRET`. As the app matures, review whether JWKS or another Supabase-recommended verification method is more appropriate for the deployment model.

## Stack Assessment

This is a solid stack for the current web app and backend. The mobile code should be treated as planned/scaffolded until task management screens, API integration, and mobile-specific workflows are implemented. The main near-term work is not replacing the stack, but tightening the engineering foundation with migrations, tests, clearer data ownership, and shared client code.
