# Final source validation - CHRONO A5

Validation date: 22 October 2026 (Australia/Sydney).

Development baseline: `3112a134f92917a3d1b9ce8776c41a62bccd405b`.
Preparation branch: `release/chrono-a5-final`.
The archive's SUBMISSION_INFO.json records the final preparation commit.

## Results

- Locked pnpm installation: passed using pnpm 10.33.2.
- Locked Python dev installation: passed using Python 3.12.10.
- Frontend ESLint: passed with zero reported errors.
- Next.js route-type generation: passed.
- Web and shared TypeScript checks: passed.
- Frontend regression tests: **249 passed, 0 failed**, also verified under Node.js **22.23.4**.
- Production Next.js build: passed under Node.js **22.23.4**; all 19 pages generated.
- Backend Ruff: passed.
- Clean PostgreSQL 16 migration: passed, current head `d7b2a6e14f09`.
- Alembic schema comparison: passed, no new upgrade operations detected.
- Backend pytest: **534 passed, 0 failed**, six deprecation warnings.
- Production Compose configuration: passed using the committed example values.
- Git whitespace check: passed.

The backend used an isolated PostgreSQL 16.15 container on loopback port 5544, with test-only credentials and a temporary upload directory. The running application database on port 5433 was not used or changed.

## Repairs included

1. ESLint globals now recognise Node test files that exercise Fetch APIs.
2. Removed the unused scheduling icon import and corrected backend import ordering.
3. Retained the ORM-registration import with an explicit, documented Ruff exemption.
4. Frontend layout regression tests now assert task links, payload and accessible empty state independently of decorative layers.
5. Priority confirmation advances its version even on the same clock tick or a backwards clock adjustment. The regression test freezes the clock and verifies duplicate confirmation is rejected.
6. Type-check scripts consistently invoke the pinned pnpm through Corepack.
7. All existing frontend regression suites are included in the CI workflow.

No checks were skipped or disabled to obtain these results. The frontend suite consists of Node-based regression tests; it is not browser end-to-end coverage.

## Non-blocking observations

The six backend warnings concern upstream HTTPX/TestClient and HTTP 422 naming deprecations. The web build reports an older Browserslist dataset and, in this nested preparation checkout, detects the parent workspace's lockfile. Both builds completed successfully. The ZIP extracts into its own root without that parent workspace.

## Interpretation

These are actual local execution results for the prepared source. They are not a newly executed hosted GitHub Actions run and do not imply deployment of this branch. The workflow is included for remote execution when the changes are pushed.

Production operations still need durable upload storage, a verified recovery process and deployment governance. Gemini tests exercise fake/no-key behaviour; they do not certify a live provider.

## Archive verification

The source was also extracted into a fresh directory. Its frozen pnpm installation
passed, all 249 frontend tests passed under Node.js 22, and all 534 backend tests
passed using the locked Python development environment. The extracted migrations
were applied to a second empty PostgreSQL database, followed by a successful
schema check. This verifies the packaged code and dependencies independently of
generated application files in the preparation checkout.

The packaging utility checks archive CRCs, allowed paths, complete inventory, file lengths and SHA-256 values before producing the ZIP checksum sidecar. The archive excludes runtime secrets, dependencies, generated build output, uploads and unrelated reports. SOURCE_MANIFEST.json identifies the exact assessed payload.
