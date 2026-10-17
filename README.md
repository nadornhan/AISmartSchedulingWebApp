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

## Design Theme

The product supports dark and light workspace themes with a shared green accent. Use `frontend/web/app/globals.css` as the implementation source for theme tokens, and `frontend/Theme.md` for visual guidance. Authentication artwork currently remains dark. The values below describe the dark palette; feature pages should consume shared variables so light mode remains consistent with the navigation shell.

### Core Palette

| Token              | Hex       | Usage                                                                   |
| ------------------ | --------- | ----------------------------------------------------------------------- |
| `--bg`             | `#07100F` | App background and full-page dashboard shell                            |
| `--surface`        | `#0D1718` | Sidebar, header, panels, and low-emphasis surfaces                      |
| `--card`           | `#121E20` | Standard cards, list rows, inputs, and tool panels                      |
| `--card-raised`    | `#182629` | Elevated cards, popovers, dropdowns, modals, and hover layers           |
| `--border`         | `#243438` | Dividers, card borders, input outlines, and subtle separators           |
| `--text-main`      | `#F4F7F6` | Primary headings, important labels, and high-emphasis text              |
| `--text-secondary` | `#A7B2B0` | Body copy, secondary labels, descriptions, and inactive nav text        |
| `--text-muted`     | `#6F7E82` | Metadata, timestamps, placeholders, helper text, and disabled UI        |
| `--primary`        | `#24D38A` | Primary actions, active navigation, success accents, and progress bars  |
| `--primary-hover`  | `#35E89B` | Hover state for primary buttons and active controls                     |
| `--primary-dark`   | `#117B55` | Pressed states, dark accents, and high-contrast green surfaces          |
| `--primary-soft`   | `#12382D` | Soft selected states, badges, pill backgrounds, and subtle green panels |

### Extended Palette

| Token      | Hex       | Usage                                                                       |
| ---------- | --------- | --------------------------------------------------------------------------- |
| `--blue`   | `#3B82F6` | Calendar events, informational states, personal folders, and neutral charts |
| `--purple` | `#7C5CFF` | Gamification, achievements, streaks, and premium/highlight moments          |
| `--orange` | `#F59E3D` | Medium priority, due-soon warnings, reminders, and attention states         |
| `--red`    | `#FF5C6C` | High priority, destructive actions, overdue tasks, and error states         |
| `--yellow` | `#FACC4C` | Study folders, highlights, streak rewards, and celebratory badges           |

### Recommended CSS Tokens

```css
:root {
  --bg: #07100f;
  --surface: #0d1718;
  --card: #121e20;
  --card-raised: #182629;
  --border: #243438;

  --text-main: #f4f7f6;
  --text-secondary: #a7b2b0;
  --text-muted: #6f7e82;

  --primary: #24d38a;
  --primary-hover: #35e89b;
  --primary-dark: #117b55;
  --primary-soft: #12382d;

  --blue: #3b82f6;
  --purple: #7c5cff;
  --orange: #f59e3d;
  --red: #ff5c6c;
  --yellow: #facc4c;
}
```

### UI Usage Guide

| UI element                               | Recommended tokens             |
| ---------------------------------------- | ------------------------------ |
| Page background                          | `--bg`                         |
| Sidebar and header                       | `--surface`                    |
| Cards and list rows                      | `--card`                       |
| Dropdowns, modals, active hover surfaces | `--card-raised`                |
| Borders and dividers                     | `--border`                     |
| Primary buttons and active nav items     | `--primary`, `--primary-hover` |
| Selected but low-emphasis states         | `--primary-soft`               |
| Main headings                            | `--text-main`                  |
| Supporting copy                          | `--text-secondary`             |
| Disabled or low-emphasis metadata        | `--text-muted`                 |
| High priority/error/destructive          | `--red`                        |
| Medium priority/warning                  | `--orange`                     |
| Low priority/info                        | `--blue`                       |
| Rewards/gamification                     | `--purple`, `--yellow`         |

## Feature File Ownership

Feature branches should change only their own page, components, frontend API helpers, and backend feature module. Shared dashboard shell files should stay owned by `feature/navigation-shell` unless the team explicitly agrees to update the global navigation or theme.

### Recommended Feature Scope

For a feature such as Calendar, work inside:

```text
frontend/web/app/(dashboard)/calendar/page.tsx
frontend/web/components/calendar/
frontend/web/lib/tasks.ts
frontend/web/lib/projects.ts
backend/api/app/tasks/
backend/api/app/projects/
```

Calendar and Priority share task and project API helpers. Scheduling recommendations use `lib/scheduling.ts` separately. Neither page needs an empty feature-named helper. See [frontend/README.md](frontend/README.md) for the current frontend map.

Use the same pattern for other features where a feature-specific helper exists:

```text
frontend/web/app/(dashboard)/<feature>/page.tsx
frontend/web/components/<feature>/
frontend/web/lib/<feature>.ts
backend/api/app/<feature>/
```

Feature pages should render only their page-specific content. Do not create separate sidebars, headers, or page-level dashboard wrappers inside feature pages because the shared dashboard layout already provides them.

### Shared Files To Avoid In Feature Branches

Avoid changing these files from feature branches unless the change is intentionally global:

```text
frontend/web/app/(dashboard)/layout.tsx
frontend/web/components/layout/dashboard-shell.tsx
frontend/web/components/layout/sidebar.tsx
frontend/web/components/layout/header.tsx
frontend/web/components/layout/icons.tsx
frontend/web/app/globals.css
frontend/web/tailwind.config.ts
README.md
```

If a feature needs a new navigation link, a new global color token, or a shared header/sidebar behavior, coordinate it with `feature/navigation-shell` first to avoid duplicate UI and merge conflicts.

## Current Development Scope

`develop` contains the integrated demo: authentication/profile, dashboard, tasks and subtasks, folders/inbox, calendar, priority, focus sessions, analytics, notifications, settings, scheduling and gamification/forest.

Authenticated feature flows use FastAPI and PostgreSQL. Docker is optional if a compatible PostgreSQL instance is supplied; mocks and the mobile/shared scaffolds are not substitutes for a full-system demonstration. No deployed production database is required for local development.

### Demonstration platform

The demonstration is the Next.js web application. React Native/Expo development is out of scope for this milestone. The `frontend/mobile` workspace is retained for possible future work; do not present it as an implemented native client or require its tooling to run the demo.

If mobile behaviour is demonstrated, use the responsive web UI with viewport/touch simulation. Native-like presentation tools may be evaluated separately, but simulation does not verify native device APIs, background execution, push delivery, offline support or app-store deployment. No emulator or native wrapper is configured by this documentation change.

## Repository Structure

```text
frontend/
  web/       Next.js web app
  mobile/    Expo mobile scaffold
backend/
  api/       FastAPI backend
packages/
  shared/    Shared TypeScript types and constants
supabase/    Historical/optional SQL notes; not the active auth/storage path
```

Feature code should stay in matching folders:

```text
frontend/web/app/(dashboard)/<feature>/page.tsx
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

| Member | Branches                                                              | Primary folders                                                                                                                                                                                                     |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `feature/navigation-shell`, `feature/settings-polish`                 | `frontend/web/components/layout`, `frontend/web/app/(dashboard)/settings`, `frontend/web/components/settings`, `backend/api/app/settings`                                                                           |
| 2      | `feature/auth-account`                                                | `frontend/web/app/login`, `frontend/web/app/register`, `frontend/web/app/(dashboard)/profile`, `frontend/web/components/auth`, `frontend/web/lib/auth.ts`, `backend/api/app/auth`                                   |
| 3      | `feature/task-management`                                             | `frontend/web/app/(dashboard)/tasks`, `frontend/web/components/tasks`, `frontend/web/lib/tasks.ts`, `backend/api/app/tasks`                                                                                         |
| 4      | `feature/folders-inbox`                                               | `frontend/web/app/(dashboard)/folders`, `frontend/web/components/folders`, `frontend/web/lib/folders.ts`, `backend/api/app/folders`                                                                                 |
| 5      | `feature/calendar-reminders`, `feature/analytics-dashboard`           | `frontend/web/app/(dashboard)/calendar`, `frontend/web/app/(dashboard)/analytics`, `frontend/web/components/calendar`, `frontend/web/components/analytics`, `backend/api/app/calendar`, `backend/api/app/analytics` |
| 6      | `feature/focus-mode`, `feature/priority-view`, `feature/gamification` | `frontend/web/app/(dashboard)/focus`, `frontend/web/app/(dashboard)/priority`, `frontend/web/app/(dashboard)/gamification`, `backend/api/app/focus`, `backend/api/app/priority`, `backend/api/app/gamification`     |

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
corepack pnpm install --frozen-lockfile
python -m venv backend/api/.venv
backend/api/.venv/Scripts/python -m pip install -e "backend/api[dev]"
```

Copy environment examples only for files that do not already exist; do not overwrite working credentials or configuration:

```powershell
Copy-Item .env.example .env
Copy-Item frontend/web/.env.example frontend/web/.env.local
Copy-Item backend/api/.env.example backend/api/.env
```

To enable Gemini features, paste the API key into `backend/api/.env`:

```env
GEMINI_API_KEY=your-gemini-api-key
```

Live AI generation requires a valid Gemini key and network access. `AI_ENABLED=false` disables the provider for isolated/offline tests; it does not verify real AI output. AI is enabled by default. The API reads this same environment file when it runs
locally or through Docker Compose. Restart the API after changing the key.

## Database Setup

The backend uses PostgreSQL 16, SQLAlchemy 2, psycopg, and Alembic.

Create the backend environment file only if it does not already exist (the copy command overwrites an existing file). Set a unique local `JWT_SECRET_KEY`; do not use the committed example secret for deployment:

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
```

Apply all migrations:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic check
```

Create the shared local test account after the API is running:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:8000/auth/register `
  -ContentType "application/json" `
  -Body '{
    "email": "alex@example.com",
    "password": "TestPassword123",
    "first_name": "Alex",
    "last_name": "Johnson",
    "role": "student"
  }'
```

On macOS or Linux:

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex@example.com",
    "password": "TestPassword123",
    "first_name": "Alex",
    "last_name": "Johnson",
    "role": "student"
  }'
```

A `409` response means that the email already exists; it does not prove that the example password matches. Use your own known test credentials. Create disposable accounts only in a test database, not by overwriting or resetting demo users.

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
# In another terminal, run the project virtual environment:
backend/api/.venv/Scripts/python -m uvicorn app.main:app --app-dir backend/api --reload
```

Containerized stack:

```powershell
docker compose up --build
```

Expected local URLs:

```text
Web: http://localhost:3001
API: http://localhost:8000
API docs: http://localhost:8000/docs
```

## Development Workflow

Start from latest `develop`:

```bash
git checkout develop
git pull
git checkout -b feature/task-management
```

Work mostly inside the folders owned by the feature branch. Shared files such as `frontend/web/app/layout.tsx`, `backend/api/app/main.py`, global CSS, and shared types should stay small and be changed carefully.

Use the existing PostgreSQL-backed APIs for integration work. Isolated mocks are useful for component tests, but should not replace the integrated demo's persistence or authentication.

## Quality Checks

```powershell
corepack pnpm lint
corepack pnpm --filter @ai-smart-scheduling/web typecheck
corepack pnpm build
corepack pnpm format:check
```

For backend changes:

```powershell
backend/api/.venv/Scripts/python -m ruff check backend/api
```

Run backend tests only after pointing `DATABASE_URL` at a disposable PostgreSQL database and applying the existing migrations there. Test fixtures roll back their transactions, but that is not a reason to use the shared demo database:

```powershell
# Set DATABASE_URL to your disposable PostgreSQL test database first.
backend/api/.venv/Scripts/python -m pytest backend/api/tests -q
```

Do not use auth bypass as evidence of successful integration. Record browser checks, test counts, existing failures and whether external Gemini output was actually exercised. Targeted auth regressions run with `corepack pnpm --filter @ai-smart-scheduling/web test:auth`; broader UI coverage remains manual.

See [the demo verification report](frontend/DEMO_VERIFICATION.md) for the current isolated test results and limitations.
