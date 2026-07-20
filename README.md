# GoalForge

<p align="center">
     <img src="https://github.com/user-attachments/assets/5f573d11-6996-4086-82cf-f82652287691" alt="GoalForge logo" width="180" />
</p>


> AI-powered goal tracker with RPG-style gamification

GoalForge turns plain-language goals into structured SMART goals with milestones and a 7-day daily task plan — powered by Gemini 2.5 Flash. Completing tasks and achieving goals earns **star points** that advance you through six evolution stages: Speck → Ember → Flare → Luminary → Nova → Celestial.

<!-- TODO: replace with a real screenshot/GIF of the Dashboard once available -->


<img width="1883" height="894" alt="Screenshot 2026-07-08 215957" src="https://github.com/user-attachments/assets/b6dae8e7-4fdf-4133-a2cb-a4fac067f206" />


---

[![CI](https://github.com/Samat-ai/goalforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Samat-ai/goalforge/actions/workflows/ci.yml)

![Python](https://img.shields.io/badge/Python-3.13-blue?logo=python)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?logo=google)

---

## Live Demo

<!-- TODO: add the live URL once deployed, e.g. http://<VPS_IP>/ -->
[goalforge.me](https://goalforge.me/)

---

## Features

- **AI goal breakdown** — describe a goal in plain language; Gemini 2.5 Flash converts it into a SMART goal with milestones and a 7-day daily task plan
- **RPG-style progression** — star points earned from completed tasks and achieved goals advance you through six evolution stages (Speck → Ember → Flare → Luminary → Nova → Celestial)
- **Adaptive sprints** — difficulty (lighter/balanced/stretch) adjusts automatically from your last 14 days of completion history
- **Rescue mode** — falling behind on a goal surfaces an "Easy Mode" re-plan instead of letting the goal go stale
- **Coach chat** — a guided Q&A flow (Coach Forge) that turns a short conversation into a fully generated goal
- **Star Log & Analytics** — collectible rewards, streaks, and progress trends over time
- **Web push notifications** — daily digest, streak-saver, and inactivity nudges (PWA, installable)

---

## Tech Stack

- **Backend**: FastAPI (async), SQLAlchemy 2.0 + asyncpg, PostgreSQL, Alembic migrations
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Query
- **Auth**: Clerk
- **AI**: Google Gemini 2.5 Flash (structured output)
- **Infra**: Docker Compose, Caddy (reverse proxy + automatic TLS)

---

## Docker Quickstart

The fastest way to get the full stack running locally:

```bash
cp apps/api/.env.example apps/api/.env   # fill in GEMINI_API_KEY and CLERK_* vars
docker compose up --build
```

| Service | URL |
|---------|-----|
| API | http://localhost:8000 |
| Frontend | http://localhost:5173 |

> **Note:** The `DATABASE_URL` in `apps/api/.env` should point to the compose db service:
> `postgresql+asyncpg://postgres:postgres@db:5432/goalforge`
>
> Postgres isn't published to the host by default. For direct `psql` access, add a
> `docker-compose.override.yml` with a `ports: ["5432:5432"]` entry on the `db` service.

---

## Quick Start (without Docker)

### Backend

```bash
cd apps/api
pip install -r requirements.txt
cp .env.example .env        # fill in DATABASE_URL, GEMINI_API_KEY, CLERK_* vars
alembic upgrade head
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd apps/web
npm install
# create apps/web/.env.local with VITE_CLERK_PUBLISHABLE_KEY=pk_...
npm run dev                 # → http://localhost:5173
```

---

## Architecture

See [`docs/goalforge-professionalization-plan.md`](docs/goalforge-professionalization-plan.md) for:
- a product roadmap focused on premium user value and retention
- engineering optimization priorities for modularity, reuse, and maintainability
- a phased execution plan (30/60/90 days) with success metrics

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for a step-by-step guide to running this stack on a VPS with Docker Compose and Caddy (reverse proxy + automatic HTTPS).

---

## Contributing

1. Fork the repo and create a `feature/<short-description>` branch.
2. Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
3. Open a pull request — automated Claude code review will run on it.

---

## License

MIT © Kerimkulov Samat — see [`LICENSE`](LICENSE).
