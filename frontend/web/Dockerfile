FROM node:22-alpine AS deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/web/package.json frontend/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/supabase/package.json packages/supabase/package.json
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/web/node_modules ./frontend/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/supabase/node_modules ./packages/supabase/node_modules
COPY . .
RUN pnpm --filter @todo-list/web build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/frontend/web ./frontend/web
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["pnpm", "--filter", "@todo-list/web", "start"]
