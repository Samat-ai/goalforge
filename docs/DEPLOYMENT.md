# Deployment (VPS + Docker Compose)

This runs the exact stack from `docker-compose.yml` on a single small VPS,
fronted by Caddy for a unified `:80` entrypoint (and automatic HTTPS the
moment a domain is pointed at it).

This guide targets **Azure** (GitHub Student Pack $100 credit + a separate
free-tier B1s VM for 12 months, so this can end up costing close to $0).
Any Ubuntu box works the same from step 3 onward — swap step 1-2 for
DigitalOcean/Hetzner if you'd rather use those.

## 1. Provision an Azure VM

Easiest path: no local install — use **Azure Cloud Shell**
(portal.azure.com → the `>_` icon top-right) which already has `az` and is
signed into your account. Run this there:

```bash
az group create --name goalforge-rg --location eastus

az vm create \
  --resource-group goalforge-rg \
  --name goalforge-vm \
  --image Ubuntu2404 \
  --size Standard_B1s \
  --admin-username deploy \
  --generate-ssh-keys \
  --public-ip-sku Standard

az vm open-port --resource-group goalforge-rg --name goalforge-vm --port 80 --priority 100
az vm open-port --resource-group goalforge-rg --name goalforge-vm --port 443 --priority 101
```

`--generate-ssh-keys` reuses `~/.ssh/id_rsa` if you already have one, or
creates a new pair. The `az vm create` output includes `publicIpAddress` —
that's `<VPS_IP>` for the rest of this guide.

> If B1s isn't available/quota-approved in `eastus` for your subscription,
> try another region (`--location westus2`) or size (`Standard_B2s`).

## 2. Harden the box

Azure already created `deploy` with SSH-key auth and sudo, and the NSG rules
from step 1 handle the cloud-level firewall. Add `ufw` on the box itself as
defense-in-depth:

```bash
ssh deploy@<VPS_IP>

sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # or log out/in again
docker --version && docker compose version
```

## 4. Clone the repo and configure secrets

```bash
git clone https://github.com/Samat-ai/goalforge.git
cd goalforge

cp apps/api/.env.example apps/api/.env
nano apps/api/.env
```

Fill in `apps/api/.env` with production values — see the env var table in
`.claude/CLAUDE.md` for what each one does. Important production-specific
values:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@db:5432/goalforge` (note the `@db`, not `@localhost` — this runs inside compose) |
| `ENVIRONMENT` | `production` (enables structured JSON logging) |
| `CORS_ORIGINS` | not load-bearing once Caddy proxies same-origin, but set it to your eventual URL anyway |
| `RATE_LIMIT_ENABLED` | `true` |
| `JOBS_API_KEY` | generate a random secret — required, no dev bypass |

Then create the frontend's build-time env file (Vite bakes these in at
`npm run build`, so this must exist *before* `docker compose build`):

```bash
nano apps/web/.env.local
```

```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_API_BASE_URL=/api
VITE_VAPID_PUBLIC_KEY=...   # only if web push is enabled
```

`VITE_API_BASE_URL=/api` is what makes the frontend call same-origin
`/api/*`, which Caddy strips and forwards to the `api` container (see
`Caddyfile`).

## 5. Bring the stack up

```bash
docker compose up -d --build
docker compose exec api alembic upgrade head
```

## 6. Verify

```bash
curl http://<VPS_IP>/health         # -> {"status":"ok"} (liveness)
curl http://<VPS_IP>/health/ready   # -> DB connectivity check
curl -I http://<VPS_IP>/           # -> frontend served via Caddy
```

Then open `http://<VPS_IP>/` in a browser and run through sign-up → create a
goal → complete a task, to confirm the full path (Clerk auth, Gemini call,
Postgres write) works end-to-end.

## Updating a deployed instance

```bash
cd goalforge
git pull
docker compose build
docker compose up -d
docker compose exec api alembic upgrade head   # only if new migrations exist
```

## Adding a real domain later

1. Point an A record for your domain at `<VPS_IP>`.
2. Edit `Caddyfile`: replace `:80` with your domain, e.g. `goalforge.app`.
3. `docker compose restart caddy` — Caddy automatically requests and renews
   a Let's Encrypt certificate; no other config changes needed.
4. Rebuild the frontend once with `VITE_API_BASE_URL=/api` unchanged (still
   same-origin) — no rebuild actually required for the domain switch itself.
