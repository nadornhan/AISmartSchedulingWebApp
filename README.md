# Todo List

Todo list app with task tracking, categories, deadlines, Pomodoro focus mode, and tree planting gamification.

## Stack

- Monorepo: pnpm workspaces
- Web: Next.js App Router, React, TypeScript, Tailwind CSS
- API: Python, FastAPI, SQLAlchemy
- Database: PostgreSQL
- Auth: Supabase Auth
- Container: Docker Compose
- Mobile: Expo React Native, TypeScript

For a more detailed explanation of the stack, data flow, and improvement roadmap, see [docs/STACK.md](docs/STACK.md).

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
python -m venv apps/api/.venv
apps/api/.venv/Scripts/python -m pip install -e apps/api
```

Copy the environment examples and fill in your Supabase project values. `SUPABASE_JWT_SECRET` is required by the API so it can verify Supabase access tokens.

```powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

## Run Locally

```powershell
corepack pnpm dev:web
corepack pnpm dev:api
corepack pnpm dev:mobile
```

Run the whole containerized stack:

```powershell
docker compose up --build
```

The web app runs on `http://localhost:3000`, the API on `http://localhost:8000`, and PostgreSQL on `localhost:5432`.

## Quality Checks

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm format:check
```

## Supabase

Supabase remains the auth provider. The frontend signs users in with Supabase email links and sends the Supabase access token to FastAPI. Task data now lives in the app PostgreSQL database through SQLAlchemy.
