# Contributing to CHRONO

Use focused feature/fix branches from develop and review changes through pull requests. Release decisions require validation of the exact candidate revision. Platform branch protection is configured separately from the workflow.

## Consistent code

Use descriptive names and existing feature folders. TypeScript uses strict types and shared API contracts; Python uses typed router/service boundaries and Ruff checks. Format changed supported files with Prettier. Avoid unrelated bulk rewrites.

Coordinate shared navigation, authentication, database and contract changes. Provide loading, empty, validation and error states. Remove unused imports and unreachable code.

## Comments and authors

Explain invariants, security boundaries, concurrency and non-obvious decisions. Do not comment every obvious statement. Preserve attribution and external notices. See AUTHORS.md and docs/AUTHORSHIP.json.

## Browser API and authentication

Use frontend/web/lib/api.ts for same-origin /api/\* requests. Only frontend/web/lib/server/api-proxy.ts handles session cookies and bearer forwarding. Configure server-side API_URL; do not add localStorage bearer tokens or component-specific API wrappers. Preserve Origin/CSRF checks.

## Database and verification

Use reviewed Alembic migrations and user-scoped API queries. Never substitute create_all() for deployment migrations. Keep real secrets outside source control.

Run README quality checks before review. Tests use disposable databases. Update installation, API and deployment documentation when behaviour changes, and associate actual results with their source revision.
