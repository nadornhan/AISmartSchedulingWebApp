# Todo List

Todo list app with task tracking, categories, deadlines, Pomodoro focus mode, and tree planting gamification.

## Stack

- Monorepo: pnpm workspaces
- Web: React, Vite, TypeScript
- Mobile: Expo React Native, TypeScript
- Backend: Supabase Auth and Supabase Postgres

## Requirements

- Node.js 24+
- Corepack enabled
- Supabase project for auth and database

## Setup

```powershell
corepack enable
corepack pnpm install
```

Copy the environment examples and fill in your Supabase project values:

```powershell
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

## Run Locally

```powershell
corepack pnpm dev:web
corepack pnpm dev:mobile
```

## Quality Checks

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm format:check
```

## Supabase

The initial database migration lives in `supabase/migrations`. Apply it to a Supabase project before building account-backed task features.
