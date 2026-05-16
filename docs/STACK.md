# Todo List Stack

This document explains the current technical stack, how the main parts of the system fit together, and which areas should be improved as the project grows.

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
apps/
  api/       FastAPI backend
  mobile/    Expo React Native scaffold
  web/       Next.js web app
packages/
  shared/    Shared TypeScript constants and task types
  supabase/  Shared Supabase client factory
supabase/
  migrations/ Supabase SQL migrations currently used for auth/profile-related planning
```

## Backend

The backend lives in `apps/api`.

Important files:

- `apps/api/app/main.py` defines the FastAPI app and task CRUD routes.
- `apps/api/app/models.py` defines SQLAlchemy ORM models.
- `apps/api/app/database.py` configures the database engine and sessions.
- `apps/api/app/auth.py` validates Supabase bearer tokens.
- `apps/api/pyproject.toml` declares Python dependencies.

The API currently supports:

- `GET /health`
- `GET /tasks`
- `POST /tasks`
- `PATCH /tasks/{task_id}`
- `DELETE /tasks/{task_id}`

## Frontend

The web app lives in `apps/web`.

Important files:

- `apps/web/app/page.tsx` contains the current task UI and Supabase sign-in flow.
- `apps/web/lib/tasks.ts` contains the browser API client for task CRUD.
- `apps/web/lib/supabase.ts` creates the browser Supabase client when environment values are present.

The mobile scaffold lives in `apps/mobile`.

Important files:

- `apps/mobile/App.tsx` contains the current mobile foundation screen.
- `apps/mobile/src/supabase.ts` creates the mobile Supabase client when environment values are present.

The mobile app is currently scaffolded but does not yet implement task CRUD or the main productivity workflows.

## Data Storage

Task data is stored in PostgreSQL through the FastAPI backend and SQLAlchemy.

Supabase should be treated as the auth provider unless the architecture is intentionally changed later. The repository currently contains a Supabase migration with a `tasks` table, but the README and active application flow use the app PostgreSQL database through SQLAlchemy for task storage. This should be clarified or cleaned up before the schema becomes more complex.

## Environment Variables

Root and app-specific `.env.example` files document the required local environment values.

Key values:

- `DATABASE_URL` connects the API to PostgreSQL.
- `SUPABASE_JWT_SECRET` lets FastAPI verify Supabase access tokens.
- `BACKEND_CORS_ORIGINS` controls which web origins can call the API.
- `NEXT_PUBLIC_API_URL` points the web app to FastAPI.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` configure web auth.
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` configure mobile auth.

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

3. Add backend API tests.

   Start with task CRUD, authentication failures, and user data isolation.

4. Add shared API client code.

   The web app has task API helpers. Mobile should eventually use the same backend contract, ideally through a shared package.

5. Plan background work.

   Reminders, notification scheduling, streaks, and analytics may eventually need background jobs or scheduled workers.

6. Review Supabase JWT verification.

   The current implementation verifies bearer tokens with `SUPABASE_JWT_SECRET`. As the app matures, review whether JWKS or another Supabase-recommended verification method is more appropriate for the deployment model.

## Stack Assessment

This is a solid stack for the current web app and backend. The mobile code should be treated as planned/scaffolded until task management screens, API integration, and mobile-specific workflows are implemented. The main near-term work is not replacing the stack, but tightening the engineering foundation with migrations, tests, clearer data ownership, and shared client code.
