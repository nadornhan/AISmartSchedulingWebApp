# CHRONO continuous integration

The GitHub Actions workflow is defined in `.github/workflows/ci.yml`.
It runs for pull requests, pushes to `main` or `develop`, and manual dispatches.
New commits cancel older runs for the same pull request or branch.

## Checks

### Frontend checks

- Node.js 22 and the pnpm version declared in the root `package.json`.
- Install dependencies with `pnpm install --frozen-lockfile`.
- ESLint for `frontend/web` and `packages/shared`.
- Generate Next.js route types, then typecheck the web and shared packages.
- Build the production Next.js application.

The mobile scaffold is outside this web-product CI scope. The build downloads
Google Fonts because the application uses `next/font/google`; no running API
is needed to build the frontend. Browser end-to-end tests are not included yet.

### Backend checks

- Python 3.12 and uv 0.12.5; install the dev extra from `uv.lock` with `--locked`.
- Ruff checks Python errors, unused imports and import ordering in `app` and `tests`.
- Start an isolated PostgreSQL 16 service and wait for its health check.
- Run `alembic upgrade head` on the empty CI database.
- Run `alembic check` to detect model changes without a matching migration.
- Run the entire `pytest tests` suite.
- Upload `backend-test-results` (JUnit XML) for 14 days, including on test failures.

The database and upload directory are disposable. CI never uses the team's
hosted database or local `.env` files. Its JWT key and PostgreSQL credentials
are public test-only values. No GitHub secrets or real Gemini API key are
required. AI tests use existing fake/mocked providers or exercise the no-key
fallback; they do not validate the live provider's availability or output.

### CI passed

This final job succeeds only when both frontend and backend jobs succeed.
A failed, cancelled or skipped dependency fails this gate. No checks are
configured with `continue-on-error`.

## Enable the workflow

Commit and push the workflow and accompanying changes, then open a pull request.
Open the repository's **Actions > CI** page to inspect each job and download
the backend test report. For manual runs, the workflow must first exist on the
repository's default branch; select **Run workflow** from that page.

CI reports failures but does not automatically prohibit merging. After the
first run, configure a branch rule/ruleset for `main` and `develop` (where
supported by the repository plan):

1. Require a pull request before merging.
2. Require status checks to pass.
3. Select the check named **CI passed**.
4. Optionally require the branch to be up to date before merging.

Repository settings are separate from the checked-in workflow. This change
does not deploy the application or configure branch protection automatically.

## Reproduce the checks locally

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm lint:ci
pnpm --filter @ai-smart-scheduling/web exec next typegen
pnpm typecheck:ci
pnpm build
```

For the backend, use a **dedicated disposable PostgreSQL database**. Set
`DATABASE_URL`, `JWT_SECRET_KEY`, `GEMINI_API_KEY` (empty), `PGTZ` (`UTC`), and `UPLOAD_DIR`
explicitly before these commands. Never point test runs at production data.

```sh
cd backend/api
uv sync --locked --extra dev
uv run --no-sync ruff check app tests
uv run --no-sync alembic upgrade head
uv run --no-sync alembic check
uv run --no-sync pytest tests -q --junitxml=test-results/pytest.xml
```

A typical test connection URL is
`postgresql+psycopg://chrono_ci:chrono_ci@localhost:5432/chrono_ci`.
On Windows PowerShell, set variables using `$env:DATABASE_URL = "..."`;
on Linux/macOS, use `export DATABASE_URL="..."`.

## Evidence for the final technical report

Record the tested commit SHA, workflow URL, run date, job outcomes and pytest
counts. Include the JUnit report and a screenshot of the checks. Describe
actual results from a completed run; a workflow file alone does not prove CI
passed. The pipeline currently covers web lint/typecheck/build, backend tests
and clean-database migrations; it does not provide deployment, browser E2E,
load testing, an upgrade test against an older release, or a security audit.

## Local validation during implementation

Validated on Windows with a newly installed Python 3.12 environment from
`uv.lock` and an isolated PostgreSQL 16 database:

- Backend Ruff: passed.
- Clean-database Alembic upgrade: passed.
- Alembic model/schema comparison: no new upgrade operations.
- Backend pytest: 517 passed (6 third-party deprecation warnings).
- Frontend/shared ESLint and TypeScript: passed.
- Next.js production build: passed using the local Node.js 24 runtime.
- Frozen pnpm lockfile verification: passed with pnpm 10.33.2.
- GitHub workflow syntax: passed actionlint 1.7.12.

The workflow uses Node.js 22 on Ubuntu; the first hosted GitHub Actions run
remains to be verified after pushing. Local verification is not a hosted CI run.

The first checks identified existing lint errors, missing model metadata for
constraints/indexes already present in migrations, a test with an expired fixed
deadline and a synthetic schedule with zero duration. These were corrected
without dropping database constraints or excluding failing tests. `PGTZ=UTC`
keeps database timestamps consistent across local and hosted CI environments.
