# Deployment (VPS + Docker Compose)

This runs the exact stack from `docker-compose.yml` on a single small VPS,
fronted by Caddy for a unified `:80` entrypoint (and automatic HTTPS the
moment a domain is pointed at it).

This guide targets **DigitalOcean** (Droplet credits). Any Ubuntu box works
the same from step 3 onward — swap step 1-2 for Azure/Hetzner if you'd
rather use those.

## 1. Provision a DigitalOcean Droplet

Easiest path: no local install — use the **DigitalOcean web console**
(cloud.digitalocean.com → Create → Droplets).

- **Image**: Ubuntu 24.04 (LTS) x64
- **Size**: Basic → Regular → the cheapest tier (1 vCPU / 1GB is enough to
  start; bump later if Docker + Postgres feel tight)
- **Region**: whichever is closest to your users
- **Authentication**: SSH key — paste your public key (`cat ~/.ssh/id_rsa.pub`),
  or generate a new pair locally first if you don't have one
- **Hostname**: `goalforge-vm`

Or via `doctl` (install + `doctl auth init` first) if you prefer the CLI:

```bash
doctl compute droplet create goalforge-vm \
  --image ubuntu-24-04-x64 \
  --size s-1vcpu-1gb \
  --region nyc1 \
  --ssh-keys <your-ssh-key-fingerprint-or-id> \
  --wait
```

The console (or `doctl compute droplet get goalforge-vm --format PublicIPv4`)
gives you the droplet's public IP — that's `<VPS_IP>` for the rest of this
guide. DigitalOcean droplets default to a `root` login (no separate `deploy`
user), so SSH in as `root@<VPS_IP>` unless you created one yourself.

## 2. Harden the box

Create a DigitalOcean **Cloud Firewall** (Networking → Firewalls → create
one, attach it to the droplet) allowing inbound SSH (22), HTTP (80), and
HTTPS (443) only. **Do not rely on `ufw` alone**: Docker inserts its own
iptables rules ahead of ufw's, so any container port published with a bare
`"HOST:CONTAINER"` mapping is reachable from the internet even with ufw
enabled. (The compose file binds `api`/`web` to `127.0.0.1` for this reason —
the Cloud Firewall is the second layer, filtering before traffic reaches the
droplet at all.)

Optionally add ufw on the box as well:

```bash
ssh root@<VPS_IP>

sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

Then add swap — the 1GB tier will OOM during `docker compose build`
(the Vite frontend build alone can exceed it):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Optional but recommended: create a non-root `deploy` user with sudo instead
of running everything as `root`.

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
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
| `DATABASE_URL` | `postgresql+asyncpg://postgres:<DB_PASSWORD>@db:5432/goalforge` (note the `@db`, not `@localhost` — this runs inside compose) |
| `ENVIRONMENT` | `production` (enables structured JSON logging **and disables the public `/docs` + `/openapi.json`**) |
| `CORS_ORIGINS` | `https://goalforge.me,https://www.goalforge.me` — also the allowlist for the Clerk JWT `azp` (authorized party) check, so it IS load-bearing |
| `RATE_LIMIT_ENABLED` | `true` |
| `JOBS_API_KEY` | generate a random secret — required, no dev bypass |

Set a real Postgres password via a root-level `.env` next to
`docker-compose.yml` (compose reads it automatically), and use the same value
in `DATABASE_URL` above:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" > .env
```

(Changing the password after the `pgdata` volume already exists requires
`ALTER USER postgres PASSWORD '...'` inside the container — the environment
variable only applies on first initialization.)

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

The Caddyfile serves `goalforge.me` + `www.goalforge.me`, so both need DNS
A records pointing at `<VPS_IP>` (Caddy retries Let's Encrypt issuance
endlessly for any listed hostname whose DNS is missing).

```bash
curl https://goalforge.me/health          # -> {"status":"ok"} (liveness)
curl -I https://goalforge.me/             # -> frontend via Caddy, security headers present
curl -I https://www.goalforge.me/         # -> www cert issued too

# Readiness/info are NOT public — probe from the droplet:
ssh root@<VPS_IP> 'curl -s localhost:8000/health/ready'

# Confirm the API is NOT directly reachable from outside (should time out):
curl -m 5 http://<VPS_IP>:8000/health || echo "good — not exposed"
```

Then open `https://goalforge.me/` in a browser and run through sign-up →
create a goal → complete a task, to confirm the full path (Clerk auth,
Gemini call, Postgres write) works end-to-end.

## 7. Operations

**Backups (do this — the droplet volume is the only copy of user data):**

```bash
crontab -e
# nightly pg_dump at 04:10, keep 14 days
10 4 * * * cd /root/goalforge && docker compose exec -T db pg_dump -U postgres goalforge | gzip > /root/backups/goalforge-$(date +\%F).sql.gz && find /root/backups -name '*.sql.gz' -mtime +14 -delete
```

`mkdir -p /root/backups` first. Better still: also enable droplet **Backups**
or **Snapshots** in the DigitalOcean panel so a copy lives off the box, and
periodically test a restore (`gunzip -c backup.sql.gz | docker compose exec -T db psql -U postgres goalforge`).

**Uptime monitoring:** point a free monitor (e.g. UptimeRobot) at
`https://goalforge.me/health`.

**Reminder emails/pushes:** the jobs endpoint must be triggered **hourly** —
it sends only to users whose `reminder_hour` matches their current local
hour, and `notification_logs` dedup makes repeat calls safe. Nothing in the
stack schedules it. Note the path really is `/api/api/jobs/...` from
outside — Caddy strips one `/api`, the router prefix adds the other:

```bash
# hourly at :05
5 * * * * curl -s -X POST https://goalforge.me/api/api/jobs/trigger-reminders -H "X-Api-Key: <JOBS_API_KEY>"
```

(The live droplet implements both crons via scripts in `/root/bin/` +
`/etc/cron.d/goalforge`, logging to `/var/log/goalforge-{backup,jobs}.log`.)

## Updating a deployed instance

```bash
cd goalforge
git pull
docker compose build
docker compose up -d
docker compose exec api alembic upgrade head   # only if new migrations exist
```

## Changing the domain later

1. Point an A record for the new domain (and `www`, if you keep it) at
   `<VPS_IP>`.
2. Edit `Caddyfile`: swap the hostnames on the first line.
3. Update `CORS_ORIGINS` in `apps/api/.env` to the new origin(s) — it also
   feeds the JWT `azp` allowlist, so a stale value breaks login.
4. `docker compose restart caddy api` — Caddy automatically requests and
   renews the Let's Encrypt certificate. `VITE_API_BASE_URL=/api` is
   same-origin, so no frontend rebuild is needed.
