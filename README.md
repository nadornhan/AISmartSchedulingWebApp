# CHRONO - Time, Intelligently Yours

CHRONO is a responsive productivity application for students and young professionals. It connects tasks, projects, calendar planning, focus sessions, analytics and forest-based progress rewards. Deterministic scheduling rules and optional Gemini assistance generate proposals for users to review and confirm.

This is the CSIT321 Group 27 final source handover. See [AUTHORS.md](AUTHORS.md), [docs/SUBMISSION.md](docs/SUBMISSION.md), [docs/FINAL_VALIDATION.md](docs/FINAL_VALIDATION.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Scope and source structure

The delivered web scope includes account access, tasks/subtasks, projects/Inbox, search and filtering, calendars, priority suggestions, scheduling/rescheduling, focus sessions, notifications, analytics and Personal Forest.

- `frontend/web/`: Next.js App Router, React, TypeScript, Tailwind and runtime assets.
- `backend/api/app/`: FastAPI application modules.
- `backend/api/alembic/`: PostgreSQL schema migrations.
- `backend/api/tests/` and `frontend/web/tests/`: regression tests.
- `packages/shared/`: shared TypeScript contracts.
- `assets/3d/` and `tools/blender/`: editable plant assets and generation tools.
- `.github/workflows/ci.yml`: CI workflow.
- `docs/`: technical and operating documentation.

The Expo mobile directory is a scaffold. Separate native mobile delivery, social sign-in, full voice integration and advanced autonomous planning are outside completed scope. External AI availability depends on provider configuration.

Browser requests use Next.js `/api/*`; the server forwards credentials to FastAPI. Sessions use HttpOnly cookies, not JavaScript-readable bearer tokens. PostgreSQL persists application data.

## Prerequisites

For Docker installation: Git, Docker Engine/Desktop with Compose v2, and a running Docker daemon.

For native development/tests: Node.js 22, Corepack, Python 3.12 and uv 0.12.5. The repository pins pnpm 10.33.2 and includes both dependency lockfiles.

Allow access to package registries and free ports 3000 (web), 8000 (API) and 5433 (PostgreSQL). The web build downloads Google Fonts. Gemini credentials are optional for core local operation.

## Obtain the source

Extract the submitted ZIP into a new directory. `SUBMISSION_INFO.json` identifies its source baseline and `SOURCE_MANIFEST.json` lists every payload file and SHA-256 hash. Use this extracted package for the exact handover changes.

For repository development:

```sh
git clone https://github.com/nadornhan/AISmartSchedulingWebApp.git
cd AISmartSchedulingWebApp
```

The development branch can advance independently of the submitted archive.

## Configure a new installation

From the repository root in PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item backend/api/.env.example backend/api/.env
Copy-Item frontend/web/.env.example frontend/web/.env.local
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

On macOS/Linux, replace `Copy-Item` with `cp`. Copy only into a fresh checkout; preserve configuration when upgrading.

Set the generated value as `JWT_SECRET_KEY` in both root `.env` and `backend/api/.env`. Do not publish it. Committed examples contain placeholders, not real deployment credentials.

- Native API: set `DATABASE_URL=postgresql+psycopg://smart_scheduler:smart_scheduler_dev@127.0.0.1:5433/smart_scheduling` in `backend/api/.env`.
- Native web: set `API_URL=http://127.0.0.1:8000` in `frontend/web/.env.local`.
- Compose overrides the API database destination to `postgres:5432` and the web server's `API_URL` to `http://api:8000`.
- `GEMINI_API_KEY` belongs only in backend configuration; leave it blank for no-provider operation.
- Leave `NEXT_PUBLIC_BYPASS_AUTH` unset or false for real authentication verification.

`NEXT_PUBLIC_API_URL` is a legacy fallback. The browser uses the same-origin proxy. Keep signing, database and provider credentials server-side.

## Docker quick start

From the repository root:

```sh
docker info
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs --tail 100 api web
docker compose exec api python -m alembic current
docker compose exec api python -m alembic heads
```

The API startup applies migrations after PostgreSQL becomes healthy. Compare the current migration with the heads in this version.

- Web: http://localhost:3000
- API documentation: http://localhost:8000/docs
- Liveness: http://localhost:8000/health/live
- Database readiness: http://localhost:8000/health/ready

The Compose API uses development reload and source bind mounts. Hosted production uses the separate deployment guide.

## Native development alternative

If API/web containers already occupy the ports, stop those services first:

```sh
docker compose stop api web
docker compose up -d postgres
corepack pnpm install --frozen-lockfile
```

In a backend terminal:

```sh
cd backend/api
uv sync --locked --extra dev --python 3.12
uv run --no-sync alembic upgrade head
uv run --no-sync alembic check
uv run --no-sync uvicorn app.main:app --reload
```

In another terminal, from the repository root:

```sh
corepack pnpm dev:web
```

Use http://localhost:3000 consistently. Changing ports requires corresponding URL/origin configuration.

To inspect a production build, run `corepack pnpm build`, then `corepack pnpm --filter @ai-smart-scheduling/web start`. Production session cookies require HTTPS; use the development server for ordinary local HTTP sign-in.

## Verify the installation

1. Confirm readiness returns `{"status":"ok","database":"ready"}`.
2. Register a fresh local account and sign in.
3. Create a project/task, edit its status/due date and refresh.
4. Review a scheduling proposal before applying it.
5. Complete a focus session and inspect its saved history.
6. Restart the API and confirm task persistence.
7. Sign out and verify protected pages require authentication.

Record results against the installed revision. A loaded landing page alone does not verify these flows.

Optional local fixtures: from the native backend, run `uv run --no-sync python scripts/seed_mock_data.py` against a disposable database. The API image does not copy the scripts directory. Hosted credentials are separate and are not included.

## Automated quality checks

From the repository root:

```sh
corepack pnpm lint:ci
corepack pnpm --filter @ai-smart-scheduling/web exec next typegen
corepack pnpm typecheck:ci
corepack pnpm --filter @ai-smart-scheduling/web test:ci
corepack pnpm build
docker compose --env-file .env.production.example -f docker-compose.prod.yml config --quiet
```

From `backend/api`:

```sh
uv run --no-sync ruff check app tests
```

Use a **dedicated disposable PostgreSQL 16 database** for migrations and tests. Set `DATABASE_URL`, `JWT_SECRET_KEY`, an empty `GEMINI_API_KEY`, `PGTZ=UTC` and a temporary `UPLOAD_DIR` explicitly. See [docs/CI.md](docs/CI.md).

```sh
uv run --no-sync alembic upgrade head
uv run --no-sync alembic check
uv run --no-sync pytest tests -q --junitxml=test-results/pytest.xml
```

Never run tests against valuable application data. CI requires both jobs to succeed; branch protection and deployment gating are separate platform settings.

## Stop, restart and upgrade

`docker compose stop` pauses services; `docker compose start` resumes them. `docker compose down` removes containers but preserves the PostgreSQL volume. Adding `-v` permanently deletes that volume and database contents.

The local API container does not have durable upload storage. Preserve required uploads separately before replacement. Back up database/uploads before upgrading; validate restoration and database compatibility before relying on rollback.

## Troubleshooting

- Docker unavailable: start Docker Desktop/Engine and retry `docker info`.
- Port conflict: stop the conflicting process or change the port and dependent URLs.
- Database connection: host uses `127.0.0.1:5433`; Compose API uses `postgres:5432`. Explicit IPv4 avoids local IPv6 forwarding problems on some Windows hosts.
- API unavailable in web: correct server-side `API_URL`, then restart/redeploy Next.js.
- Old browser session: sign out and sign in again; do not restore localStorage tokens.
- Rejected mutation: preserve the proxy's Origin and CSRF controls and use the shared API client.
- Gemini unavailable: inspect backend configuration/logs and test deterministic behaviour separately.
- Wrong pnpm version: invoke `corepack pnpm` consistently using a supported Node installation.

## Credits and maintenance

[AUTHORS.md](AUTHORS.md) identifies all six members. [docs/AUTHORSHIP.json](docs/AUTHORSHIP.json) records source-file contributors from Git history. [CONTRIBUTING.md](CONTRIBUTING.md) defines coding/comment conventions. Preserve external notices listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The demonstration addresses are https://chronow.org and https://api.chronow.org. Cloudflare manages DNS, Vercel hosts Next.js and Render hosts FastAPI/PostgreSQL. Installation, source verification and production readiness are distinct checks.
