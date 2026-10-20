# CHRONO deployment guide

This guide covers the release path from `develop` to a production deployment.
Deploy to a staging URL before buying or connecting a custom domain.

## Production architecture

```text
Browser -> Next.js web -> FastAPI API -> PostgreSQL
                              |
                              +-> persistent avatar volume
                              +-> Gemini API
```

The committed `docker-compose.yml` remains the local development stack. Use
`docker-compose.prod.yml` only for a production-like single-host deployment.
Managed hosting may deploy the web, API and PostgreSQL as separate services
using the same environment variables.

## 1. Rotate credentials before the first deployment

- Revoke any Gemini key that has been pasted into chat, source code, screenshots
  or shared documents. Create a new key for the deployed backend.
- Generate a unique JWT signing key of at least 32 random characters.
- Generate a unique PostgreSQL password.
- Store secrets in the hosting provider's secret manager. Never commit
  `.env.production` or use values from an example file as real credentials.

## 2. Configure the environment

Copy `.env.production.example` to `.env.production` only when testing the
production Compose stack locally. Required values are:

| Variable              | Purpose                                                             |
| --------------------- | ------------------------------------------------------------------- |
| `APP_ENVIRONMENT`     | Set to `staging` or `production`.                                   |
| `DATABASE_URL`        | PostgreSQL SQLAlchemy URL.                                          |
| `JWT_SECRET_KEY`      | Private JWT signing secret, at least 32 characters.                 |
| `NEXT_PUBLIC_API_URL` | Public HTTPS URL of the API. This is embedded during the web build. |
| `CORS_ORIGINS`        | Comma-separated exact frontend origins, without paths.              |
| `GEMINI_API_KEY`      | New server-side Gemini key. Never expose it to Next.js.             |
| `UPLOAD_DIR`          | Persistent avatar directory; `/app/uploads` in production Compose.  |

Leave `CORS_ALLOW_ORIGIN_REGEX` empty outside local development. Add every
staging/production frontend origin explicitly to `CORS_ORIGINS`.

## 3. Validate configuration and build images

```powershell
Copy-Item .env.production.example .env.production
# Replace every placeholder in .env.production first.
corepack pnpm docker:prod:config
docker compose --env-file .env.production -f docker-compose.prod.yml build
```

The production configuration deliberately has no source-code bind mounts and
does not run Uvicorn with `--reload`.

## 4. Prepare PostgreSQL

Back up an existing database before migrations. The API startup command runs:

```text
python -m alembic upgrade head
```

For a managed API service, use that command as its release/pre-deploy command
when possible, then start Uvicorn separately. Confirm the current revision with
`python -m alembic current`.

## 5. Preserve uploaded avatars

The single-host Compose stack stores avatars in the named `uploads-data`
volume. Configure a persistent disk mounted at `UPLOAD_DIR` when the API is
hosted separately. Do not scale the API to multiple instances while using a
single local disk; move uploads to object storage before horizontal scaling.

Database backups do not include avatar files. Back up both PostgreSQL and the
upload volume.

## 6. Verify staging

Check the deployment endpoints first:

```text
GET /health/live   -> API process is running
GET /health/ready  -> API can reach PostgreSQL
```

Then complete this smoke-test checklist:

- Register, sign in, refresh the page and sign out.
- Create, edit, complete and reschedule a task.
- Generate task decomposition, priority and duration suggestions with Gemini.
- Start, stop and finish a multi-task Focus session.
- Confirm Growth Points, achievements, plant progression and the 3D forest.
- Upload an avatar, restart/redeploy the API and confirm the avatar remains.
- Check dashboard, task, Focus, gamification and settings pages on desktop and mobile widths.
- Confirm browser requests use the HTTPS API URL and have no CORS or mixed-content errors.

## 7. Release and connect the domain

After staging and CI are green:

1. Open a reviewed PR from `develop` to `main`.
2. Deploy the immutable `main` commit.
3. Connect the custom domain and enable HTTPS.
4. Update `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` with the final domains.
5. Rebuild the Next.js image because `NEXT_PUBLIC_API_URL` is a build-time value.
6. Repeat the smoke tests and record the deployed commit SHA.

## Rollback

Keep the previous web/API image tag. If a release fails, restore the previous
application images. Do not downgrade the database until the migration's
downgrade path and data impact have been reviewed. Restore PostgreSQL from a
verified backup only when application rollback is insufficient.
