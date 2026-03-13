# GoalForge

> AI-powered goal tracker with RPG-style gamification

GoalForge turns plain-language goals into structured SMART goals with milestones and a 7-day daily task plan — powered by Gemini 2.5 Flash. Completing tasks and achieving goals earns **star points** that advance you through six evolution stages: Speck → Ember → Flare → Luminary → Nova → Celestial.

![Screenshot placeholder]()

---

[![CI](https://github.com/Samat-ai/goalforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Samat-ai/goalforge/actions/workflows/ci.yml)

![Python](https://img.shields.io/badge/Python-3.13-blue?logo=python)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?logo=google)

---

## Quick Start

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

See [`CLAUDE.md`](.claude/CLAUDE.md) for detailed architecture docs, data model, API endpoints, and coding conventions.

---

## Contributing

1. Fork the repo and create a `feature/<short-description>` branch.
2. Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
3. Open a pull request — automated Claude code review will run on it.

---

## License

MIT © Kerimkulov Samat — see [`LICENSE`](LICENSE).
