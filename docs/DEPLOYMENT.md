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

## DNS (Cloudflare zone `goalforge.me`)

Nameservers: `jacqueline.ns.cloudflare.com` / `newt.ns.cloudflare.com`
(registrar: Namecheap, Custom DNS). Full record set:

| Host | Type | Target | Proxy | Serves |
|---|---|---|---|---|
| `goalforge.me` | CNAME | `goalforge-a67.pages.dev` | proxied | frontend |
| `www` | CNAME | `goalforge-a67.pages.dev` | proxied | frontend |
| `api` | CNAME | `experimental-feijoa-f31e2pipwj2wb182zgvbcr7h.herokudns.com` | DNS-only | API |
| `clerk`, `accounts` | CNAME | `*.clerk.services` | DNS-only | Clerk auth |
| `clk._domainkey`, `clk2._domainkey`, `clkmail` | CNAME | `*.2lnxmy1tstw7.clerk.services` | DNS-only | Clerk email |
| `send` | MX 10 + TXT (SPF) | `feedback-smtp.us-east-1.amazonses.com` | — | Resend |
| `resend._domainkey` | TXT (DKIM) | `p=MIGf...` | — | Resend |
| `_dmarc` | TXT | `v=DMARC1; p=none;` | — | email |

Gotchas learned at cutover:
- The Pages CNAME target is the **project subdomain with suffix**
  (`goalforge-a67.pages.dev`), not `<project>.pages.dev` — a wrong target
  serves Cloudflare error 1014 "CNAME Cross-User Banned".
- `api` must stay **DNS-only** (grey cloud) or Heroku ACM cert issuance breaks.
- Deleting the Resend (`send`, `resend._domainkey`) or Clerk records silently
  kills all email / all logins respectively.

## TLS

Both certs are fully automatic — nothing to renew by hand:
- `goalforge.me`/`www`: Cloudflare Universal SSL at the edge.
- `api.goalforge.me`: Heroku ACM (Let's Encrypt). Status: `heroku certs:auto
  -a goalforge-api`; force a re-check with `heroku certs:auto:refresh`.
  "Unable to resolve DNS" right after a DNS change is usually Heroku's
  resolver cache — it clears within the hour.

The uptime workflow alerts at <14 days remaining on either host, which only
fires if one of these renewal pipelines has been broken for weeks.

## Credentials inventory

| Credential | Lives in | Scope / notes |
|---|---|---|
| App secrets (Clerk, Gemini, Resend, VAPID, `JOBS_API_KEY`, Sentry, `GOOGLE_SA_JSON`) | Heroku config vars | source of truth for prod |
| `HEROKU_API_KEY` | GitHub Actions secret | `read-protected` authorization (config reads only), minted for db-backup |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions secret | R2 Storage Edit only |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions secret | not actually secret |
| Frontend build env (`pk_live`, Sentry DSN, VAPID public) | gitignored `apps/web/.env.production.local` | baked into the bundle at build |
| Local dev | `apps/api/.env`, `apps/web/.env.local` | gitignored |

Rotation notes: the VAPID pair (Heroku `VAPID_PRIVATE_KEY` + frontend
`VITE_VAPID_PUBLIC_KEY`) is a cryptographic pair — rotating either
invalidates every push subscription. Rotating `JOBS_API_KEY` needs only the
Heroku config var (the Scheduler job reads it from env at runtime).

## Runbook

```bash
heroku logs -a goalforge-api --tail        # live logs (JSON in production)
heroku ps -a goalforge-api                 # dyno state
heroku releases -a goalforge-api           # deploy history
heroku rollback -a goalforge-api           # instant rollback to previous release
heroku pg:info -a goalforge-api            # DB status / connection count (cap 20)
```

- Errors land in Sentry (both apps). Uptime/backup failures email the repo
  owner via GitHub Actions.
- **Heroku router kills requests at 30s** — the coach send is synchronous
  Gemini (5-15s typical); if it ever starts hitting 30s, make it async like
  goal forging.
- Gemini `429 RESOURCE_EXHAUSTED` on Vertex is **capacity, not billing** —
  check flash vs flash-lite separately; emergency fallback is
  `GOOGLE_GENAI_USE_VERTEXAI=false` (switches to the AI Studio key, free tier).
- Frontend rollback: Cloudflare Pages dashboard → Deployments → rollback, or
  redeploy any older `dist` with wrangler.

## Monitoring

- `.github/workflows/uptime.yml` — 15-min probes (API health, frontend, auth
  401, TLS expiry on both hostnames); failures email the repo owner.
- `.github/workflows/db-backup.yml` — nightly 04:10 UTC dump → R2 with
  listing-based size verification; failures email the repo owner. Both
  scheduled workflows pause after 60 days without repo activity.
- Sentry (errors only) on both apps, gated on `(VITE_)SENTRY_DSN`.
- Simple Analytics on the frontend (SRI-pinned script tag in `index.html`).
