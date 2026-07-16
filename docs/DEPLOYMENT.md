# Deployment (Heroku + Cloudflare Pages)

Production since the 2026-07-16 cutover. The previous single-VPS/Caddy setup
(DigitalOcean droplet, retired and destroyed) lived in this file until then —
see git history if you ever need it.

## Architecture

| Piece | Where | Domain |
|---|---|---|
| API (FastAPI, Docker) | Heroku app `goalforge-api` (Basic dyno, `--workers 1`) | `api.goalforge.me` |
| Postgres | Heroku Essential-0 add-on (20-conn cap) | — |
| Frontend (React/Vite) | Cloudflare Pages project `goalforge` | `goalforge.me`, `www` |
| DNS | Cloudflare zone `goalforge.me` | — |
| Cron | Heroku Scheduler (hourly `:10` → `POST /api/jobs/trigger-reminders`) | — |
| Backups | GitHub Actions nightly (`.github/workflows/db-backup.yml`) → R2 bucket `goalforge-backups`, 30-day lifecycle | — |

There is no reverse proxy: user routes are served with **no `/api` prefix**
(`api.goalforge.me/users/...`); only the jobs router mounts its own
`/api/jobs` prefix. The old Caddy layer used to strip a `/api` prefix — any
lingering double-prefix references are stale.

## Deploying the API

Git-push to Heroku builds `apps/api/Dockerfile` per `heroku.yml`; the release
phase runs `alembic upgrade head` automatically.

```bash
git push https://git.heroku.com/goalforge-api.git main
heroku releases:output -a goalforge-api   # release-phase (migration) log
heroku logs -a goalforge-api --tail
```

Windows gotcha: if Git credential prompts hijack the push, use
`git -c credential.helper= -c credential.helper='!f(){ echo username=heroku; echo password=$(heroku auth:token); }; f' push ...`

## Deploying the frontend

Vite env vars are **build-time**. Prod values live in the gitignored
`apps/web/.env.production.local` (`VITE_API_BASE_URL=https://api.goalforge.me`,
`pk_live` Clerk key, Sentry DSN, VAPID public key).

```bash
cd apps/web
npm run build
npx wrangler pages deploy dist --project-name goalforge --branch main
```

## Config / secrets

`heroku config -a goalforge-api` is the source of truth. Notable:

| Variable | Note |
|---|---|
| `DATABASE_SSL_REQUIRED=true` | Heroku PG is self-signed; `DATABASE_CA_FILE` enables full verification if a CA exists |
| `GOOGLE_SA_JSON` | Vertex service-account JSON, written to `/tmp` at boot — set `/tmp/...` config vars from PowerShell, never Git Bash (MSYS rewrites the path) |
| `CORS_ORIGINS` | Also the Clerk JWT `azp` allowlist — a stale value breaks ALL logins |
| `ENVIRONMENT=production` | JSON logging + disables public `/docs` |

## Database

```bash
# psql into prod (no local psql needed)
docker run --rm -it postgres:17-alpine psql "$(heroku config:get DATABASE_URL -a goalforge-api)?sslmode=require"

# restore a backup into a fresh DB
heroku pg:reset DATABASE_URL -a goalforge-api --confirm goalforge-api
gunzip -c goalforge-<date>.sql.gz | docker run --rm -i postgres:17-alpine psql "$(heroku config:get DATABASE_URL -a goalforge-api)?sslmode=require"
# "role postgres does not exist" OWNER errors during restore are harmless.
```

Nightly dumps land in the R2 bucket `goalforge-backups` (30-day retention):

```bash
npx wrangler r2 object get goalforge-backups/goalforge-<date>.sql.gz --file dump.sql.gz --remote
```

## Scheduler (reminder emails/pushes)

The jobs endpoint must fire **hourly** — it sends only to users whose
`reminder_hour` matches their current local hour; `notification_logs` dedup
makes repeat calls safe. The Heroku Scheduler job (hourly at :10) runs:

```bash
python -c "import os,urllib.request as u; print(u.urlopen(u.Request('https://goalforge-api-10adac935ed0.herokuapp.com/api/jobs/trigger-reminders', method='POST', headers={'X-Api-Key': os.environ['JOBS_API_KEY']}), timeout=60).status)"
```

(Python, not curl: scheduler dynos run inside the slim API image, which has no
curl — and `$VAR` in the command line would be logged expanded, so the key is
read from env inside Python.)

## Monitoring

- `.github/workflows/uptime.yml` — 15-min probes (API health, frontend, auth
  401, TLS expiry on both hostnames); failures email the repo owner.
- `.github/workflows/db-backup.yml` — nightly 04:10 UTC dump → R2 with
  round-trip verification; failures email the repo owner.
- Sentry (errors only) on both apps, gated on `(VITE_)SENTRY_DSN`.
