# CHRONO deployment guide

This guide covers staging configuration and the controlled production release path.
The demonstration uses https://chronow.org and https://api.chronow.org, with
Cloudflare DNS, Vercel web hosting and Render API/PostgreSQL hosting.

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

## Recommended managed staging

The repository includes deployment definitions for the recommended staging
topology:

- `render.yaml` provisions the FastAPI service and a managed PostgreSQL
  database in Render's Singapore region.
- `frontend/web/vercel.json` configures the web package; set the Vercel project
  root to `frontend/web` for the current managed setup.

Create staging in this order:

1. In Render, create a Blueprint from this repository and select `render.yaml`.
2. Supply a newly rotated `GEMINI_API_KEY`. For the initial API deploy, set
   `CORS_ORIGINS` to a temporary HTTPS placeholder such as
   `https://staging.invalid`; replace it as soon as Vercel assigns the frontend
   URL.
3. Wait for `/health/live` and `/health/ready` to return HTTP 200, then copy the
   Render API URL.
4. In Vercel, import this repository with `frontend/web` as the project root
   and set server-side `API_URL` to the Render API URL before deploying.
5. Copy the stable Vercel project URL into Render's `CORS_ORIGINS`, without a
   trailing slash, and redeploy the API.
6. Redeploy Vercel if the API URL changes. Existing `NEXT_PUBLIC_API_URL` values
   remain supported as a fallback; prefer `API_URL` for new deployments.

Do not enable a wildcard production CORS origin. Add additional Vercel preview
origins explicitly only when a preview needs to call the shared staging API.

The free staging API filesystem is ephemeral. Avatar uploads can be used for a
short smoke test but can disappear after a deploy or restart. Before production,
attach persistent storage or move uploads to object storage. Do not store
database files on the API filesystem.

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

| Variable              | Purpose                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENVIRONMENT`     | Set to `staging` or `production`.                                                                                                       |
| `DATABASE_URL`        | PostgreSQL SQLAlchemy URL.                                                                                                              |
| `JWT_SECRET_KEY`      | Private JWT signing secret, at least 32 characters.                                                                                     |
| `API_URL`             | Server-side API URL used by Next.js. Use the Render HTTPS URL on Vercel; Compose defaults to `http://api:8000` on its internal network. |
| `NEXT_PUBLIC_API_URL` | Legacy fallback API URL, retained for existing deployments/builds.                                                                      |
| `CORS_ORIGINS`        | Comma-separated exact frontend origins, without paths.                                                                                  |
| `GEMINI_API_KEY`      | New server-side Gemini key. Never expose it to Next.js.                                                                                 |
| `UPLOAD_DIR`          | Persistent avatar directory; `/app/uploads` in production Compose.                                                                      |

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
- Confirm browser requests use the frontend's HTTPS `/api/*` routes.
- Confirm login returns only `{ "authenticated": true }`, and its session cookie
  is HttpOnly, Secure, SameSite=Lax, host-only and expires with the JWT.
- Confirm logout removes the cookie, refresh requires login, and unsafe requests
  with a missing or different Origin / CSRF header receive HTTP 403.
- Confirm no access token is stored in localStorage or sessionStorage. Existing
  users must sign in again after this cookie-authentication upgrade.

## 7. Release and connect the domain

After staging and CI are green:

1. Open a reviewed PR from `develop` to `main`.
2. Deploy the immutable `main` commit.
3. Connect the custom domain and enable HTTPS.
4. Update server-side `API_URL` and `CORS_ORIGINS` with the final domains.
5. Redeploy Next.js with the updated runtime API configuration.
6. Repeat the smoke tests and record the deployed commit SHA.

## Rollback

Keep the previous web/API image tag. If a release fails, restore the previous
application images. Do not downgrade the database until the migration's
downgrade path and data impact have been reviewed. Restore PostgreSQL from a
verified backup only when application rollback is insufficient.
