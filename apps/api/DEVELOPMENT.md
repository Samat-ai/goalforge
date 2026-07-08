# Development Setup

## Prerequisites

- Python 3.13+
- PostgreSQL 15+ running locally
- [`uv`](https://github.com/astral-sh/uv) or `pip` for dependency management

## First-time setup

```bash
# 1. Copy the environment file
cp .env.example .env

# 2. Edit .env with your local credentials
#    (DATABASE_URL, GEMINI_API_KEY, CLERK keys)

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run database migrations
alembic upgrade head

# 5. Start the API
uvicorn main:app --reload
```

## Seed demo data

The seed script populates the database with a realistic demo user, three goals,
and several weeks of task history so you can develop against real-looking data
without needing to click through the UI.

```bash
# Create demo user with 3 goals and 28+ days of history
python seed.py

# Seed for a specific Clerk user ID (useful when testing against a real Clerk account)
python seed.py --user-id user_2abc123

# Wipe all data for the demo user and re-seed from scratch
python seed.py --clear

# Wipe then re-seed for a specific user
python seed.py --clear --user-id user_2abc123
```

The seed script is **idempotent** — running it twice without `--clear` is safe;
it will detect existing data and exit early.

The script **refuses to run** if `ENVIRONMENT=production` is set in `.env`.

### What the seed creates

| Item | Detail |
|---|---|
| User | `user_demo_001`, 340 star points, `America/New_York` |
| Goal 1 | "Run a 5K in under 30 minutes" — health, active, 60% progress |
| Goal 2 | "Master TypeScript and Ship a Side Project" — learning, active, 30% progress |
| Goal 3 | "Build a $5,000 Emergency Fund" — finance, **achieved**, 100% progress |
| Milestones | 4 + 3 + 4 = 11 total across the three goals |
| Task history | ~84 tasks for running (28 days), ~28 for TypeScript (14 days), 90 for savings |
| Rewards | 5 collectibles: `sunset_ember` theme (equipped), `streak_survivor` title, `lore_ember`, `comeback_kid`, `lore_speck` |
| Coach session | 1 completed session linked to Goal 1, 10 messages |
| Star logs | 2 weekly entries with AI-style narrative text |
| Weekly reflection | 1 entry, rating 4/5 |

## Running tests

```bash
pytest
```

## Alembic migrations

```bash
# Generate a new migration after changing models.py
alembic revision --autogenerate -m "describe your change"

# Apply all pending migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1
```
