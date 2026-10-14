# Cleanup and refactoring audit

## Current status (2026-10-15)

The planned cleanup/refactoring batches are complete:

- Unused frontend modules and unregistered backend calendar/priority source
  scaffolds were removed; backend tests are grouped by feature.
- Task data loading, list views, mutations and AI-entry state are separated.
- Calendar date helpers, responsive views and API orchestration are separated.
- Focus timer/session coordination and task-choice loading are separated from UI.
- Backend analytics metrics, scheduling-plan helpers and gamification query/response
  helpers now have dedicated modules; existing service entry points are retained.
- The unused `chrono-node` dependency was removed from the web manifest and lockfile.
  Used UI/3D dependencies and the deferred mobile/shared workspaces remain.
- The current code map and verification notes are updated. The demonstrated features,
  database schema, migration history and infrastructure are preserved.

Task has 70 targeted checks, Calendar 16 and Focus 16, recorded in their completed
batches. The final backend extraction passed all 518 existing backend tests on a
disposable PostgreSQL instance. Scoped Python lint and the web production build
passed. See [DEMO_VERIFICATION.md](DEMO_VERIFICATION.md) for test methods and limits.

The Pomodoro settings/API range mismatch and the original cross-origin auth
transport trigger remain separate bug/integration follow-ups. Mobile implementation,
deployment and live Gemini verification remain outside the demonstration cleanup.
Large cohesive view/engine files may remain; line count alone is not a reason to
split them further. No additional mandatory extraction is queued for this batch.

## Initial deletion batch (historical)

The following audit describes the first batch only. Its integrity/import counts
and retained/deferred decisions are historical; later changes are summarized above.

Date: 2026-10-12. Baseline: GitHub `develop`, `3fb1d1d4a805cd2849d4802c3d763f7dc82f70e0`.

The workspace was fast-forwarded to this commit after saving its old staged, unstaged and untracked edits in a named Git stash and an independent backup. Those earlier edits were not reapplied to the current demo implementation. The separate checkout serving port 3001 was not modified.

## Removed files

A TypeScript AST import/export scan included static imports, re-exports, literal dynamic imports, relative paths and the configured `@/*` alias. Starting from Next.js route/layout entry points and configuration files, it found 108 reachable modules out of 117, no unresolved internal references, and no nonliteral dynamic imports. Repository-wide filename/export searches also found no callers for these nine modules:

- `web/app/(dashboard)/_components/page-placeholder.tsx`
- `web/components/dashboard/focus-session-launcher.tsx`
- `web/components/layout/profile-menu.tsx`
- `web/components/priority/PriorityTipBar.tsx`
- `web/components/settings/account-actions.tsx`
- `web/lib/calendar.ts` (empty export)
- `web/lib/priority.ts` (empty export)
- `web/lib/natural-language-task.ts`
- `web/lib/scheduling-format.ts`

Seven `.gitkeep` markers were removed from populated `web/components/{calendar,focus,folders,layout,priority,settings,tasks}` directories. The populated `backend/api/alembic/versions` directory also no longer needs its marker; all 32 migration scripts are retained.

These tracked deletions remain recoverable from Git. Documentation references to the removed empty API helpers were corrected.

## Retained boundaries

- All active routes, components, styling, public assets, API helpers, event contracts, auth behaviour and backend code.
- Existing settings API persistence and PostgreSQL schema/migrations.
- Mobile/shared workspace scaffolds, backend package initializers and the avatar-upload directory marker.
- Backend folders/projects compatibility APIs and unregistered calendar/priority scaffolds pending a separate ownership decision.
- The dependency manifest and lockfile, including `chrono-node`; dependency removal is a separate review, not part of this batch.

No active implementation was moved, renamed or rewritten. Large live components remain candidates for a later, separately verified extraction batch.

## Verification

- Production build: passed on Next.js 16.2.6; all application routes generated.
- TypeScript: `tsc --noEmit` passed after cleanup and build.
- Import reachability: all 108 remaining modules are reachable; no unresolved internal imports or nonliteral dynamic imports.
- Integrity comparison: all remaining frontend code, route entries, public assets, dependency manifests/lockfile, backend code and migration scripts have identical SHA-256 hashes to the GitHub `develop` baseline. Only the audited deletions and documentation updates differ.
- Production HTTP smoke check: 15 existing routes returned 200; an unknown route returned 404. This checks serving/route availability, not signed-in feature behaviour. The temporary port 3002 server was stopped afterward; the existing port 3001 server remains untouched.
- ESLint: three errors, identical to a read-only lint run against the untouched checkout of the same GitHub commit. Existing findings are `no-explicit-any` in `forest-scene-3d.tsx:753` and unused `VoiceTaskButton` / `setRecentlyGeneratedDetails` bindings in `create-task-modal.tsx:7,261`. No additional lint findings were introduced. These are deferred from the deletion-only batch.
- `git diff --check`: passed.

Backend integration and authenticated browser flows have not been rerun for this deletion-only batch. No database migrations were executed and no application data was changed.
