# GoalForge

AI-powered goal tracker with RPG-style gamification. Users describe a goal in plain language;
Gemini 2.5 Flash converts it into a SMART goal with milestones and a 7-day daily task plan.
Completing tasks and achieving goals earns **star points**, which advance the user through
six evolution stages (Speck → Ember → Flare → Luminary → Nova → Celestial).

## Repo layout

```
apps/
  api/   # Python FastAPI backend (async)
  web/   # React 19 + TypeScript + Vite frontend
```

## Backend — apps/api/

### Setup

```bash
cd apps/api
pip install -r requirements.txt
cp .env.example .env   # fill in values
alembic upgrade head   # run all migrations
```

**Required env vars** (`.env`):

| Variable | Example / notes |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/goalforge` |
| `GEMINI_API_KEY` | Google AI Studio key |
| `DEBUG` | `false` (optional) |
| `CLERK_JWKS_URL` | `https://<your-clerk-domain>.clerk.accounts.dev/.well-known/jwks.json` |
| `CLERK_SECRET_KEY` | Clerk secret key (`sk_test_...` from Clerk dashboard) |

Tables are also auto-created on startup via `Base.metadata.create_all` (dev convenience only —
use Alembic for schema changes).

### Run

```bash
uvicorn main:app --reload --port 8000
```

### Key files

| File | Purpose |
|---|---|
| `main.py` | FastAPI app + all route handlers |
| `ai_utils.py` | `generate_smart_goal()` — Gemini structured-output call |
| `models.py` | SQLAlchemy ORM: `User`, `Goal`, `DailyTask` |
| `schemas.py` | Pydantic I/O models + internal `AIGoalOutput` / `AITaskOutput` |
| `database.py` | Async engine + `get_db()` session dependency |
| `config.py` | Pydantic Settings (reads `.env`) |
| `auth.py` | JWT auth dependencies: `get_current_user_id`, `get_current_user_email` |

### API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/users/{user_id}/profile` | Returns `star_points` for user |
| `POST` | `/users/{user_id}/goals` | Create SMART goal via Gemini (upserts user row) |
| `GET` | `/users/{user_id}/goals` | List user's goals (newest first) |
| `GET` | `/goals/{goal_id}` | Get single goal with tasks |
| `PATCH` | `/goals/{goal_id}` | Update status (`active` / `achieved` / `abandoned`) — awards **+100 ⭐** on first achievement |
| `PATCH` | `/goals/{goal_id}/progress` | Set progress `0–100` |
| `DELETE` | `/goals/{goal_id}` | Permanently delete goal + all its tasks |
| `GET` | `/goals/{goal_id}/tasks` | List tasks (optional `?assigned_date=YYYY-MM-DD`) |
| `PATCH` | `/tasks/{task_id}/complete` | Mark task done — awards **+10 ⭐** to owner |
| `PATCH` | `/tasks/{task_id}` | Update pending task description |
| `DELETE` | `/tasks/{task_id}` | Delete pending task |
| `GET` | `/health` | Health check (hidden from OpenAPI docs) |
| `POST` | `/goals/{goal_id}/milestones/{milestone_id}/complete` | Mark sprint done, unlock next sprint |

CORS allows `http://localhost:5173` only. Tighten `allow_origins` before deploying.

### Data model

```
users          id (Clerk user_id), email (unique=True), star_points, created_at
goals          id (uuid), user_id → users, raw_input, smart_title, smart_description,
               goal_type, target_date, status, current_streak, best_streak, vitality,
               progress (0-100), created_at
milestones     id (uuid), goal_id → goals, title, position, is_final, sprint_theme,
               sprint_status (pending|generating|ready|active|completed|failed),
               is_completed, completed_at, created_at
daily_tasks    id (uuid), goal_id → goals, milestone_id → milestones (nullable),
               description, tip, assigned_date, is_completed, completed_at
```

`GoalResponse` computed fields: `completed_days`, `milestones_completed`, `milestones_total`.

## Frontend — apps/web/

### Setup

```bash
cd apps/web
npm install
```

Create `apps/web/.env.local`:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_...        # required — Clerk dashboard
VITE_API_BASE_URL=http://localhost:8000  # optional, defaults to localhost:8000
```

### Commands

```bash
npm run dev      # dev server → http://localhost:5173
npm run build    # TypeScript check + Vite production build
npm run lint     # ESLint
npm run preview  # preview production build
npx tsc --noEmit  # fast type-check without building — run after every edit
```

### Routes

| Path | Component | Auth |
|---|---|---|
| `/` | `LandingPage` | public |
| `/sign-in` | `SignInPage` | public |
| `/sign-up` | `SignUpPage` | public |
| `/dashboard` | `Dashboard` | `AuthGuard` |
| `/analytics` | `Analytics` | `AuthGuard` |

`AuthGuard` (in `App.tsx`) redirects signed-out users to `/sign-in`.

### Key files

| File | Purpose |
|---|---|
| `src/main.tsx` | Entry — Clerk `<ClerkProvider>` wraps app |
| `src/App.tsx` | Router + `AuthGuard` component |
| `src/pages/Dashboard.tsx` | Main view: goals, daily tasks, gamification UI — also defines internal sub-components `Btn`, `Badge`, `TodayBar`, `AddGoal`, `GoalCard` (no separate files for these) |
| `src/pages/Analytics.tsx` | Goal analytics and progress charts |
| `src/components/AppHeader.tsx` | Shared header with nav and user info |
| `src/components/GamificationSvgs.tsx` | SVG assets for star evolution stages |
| `src/lib/api.ts` | Axios client — injects Clerk JWT as Bearer token |
| `src/lib/gamification.ts` | Stage thresholds, `getStage()`, streak calc, star brightness |

### Gamification system (`src/lib/gamification.ts`)

Star points thresholds:

| Stage | Points needed |
|---|---|
| Speck | 0 |
| Ember | 30 |
| Flare | 80 |
| Luminary | 175 |
| Nova | 350 |
| Celestial | 600 |

Key exports: `getStage(pts)`, `getNext(pts)`, `stagePct(pts)`, `streak(days)`, `starBrightness(days)`.
`starBrightness` = `Math.min(1, streak(days) / 7)` — scales 0→1 over 7 consecutive days.

## Architecture notes

- **AI flow**: `POST /users/{user_id}/goals` → `generate_smart_goal(raw_input)` → Gemini returns
  structured `AIGoalOutput` (Pydantic-enforced) → persists `Goal` + `DailyTask` rows → `GoalResponse`.
- **Star points**: awarded atomically via SQL `UPDATE ... SET star_points = star_points + N`
  to avoid race conditions. +10 per completed task, +100 on first goal achievement.
- **DB session**: all handlers inject `db: AsyncSession = Depends(get_db)`. Sessions auto-commit
  on success and roll back on exception.
- **User resolution & Auth**: `get_or_create_user()` in `main.py` upserts a `User` row using the Clerk `user_id` path param. **Note:** The `user_id` is a Clerk string (e.g., `user_2...`), NOT a UUID. Email is extracted from the JWT payload; if absent, a unique placeholder `{sub}@placeholder.goalforge.app` is used to avoid violating `User.email`'s unique constraint.
- **`settings` import in main.py**: `settings` from `config.py` is NOT imported by default — add `from config import settings` explicitly when adding `settings.*` references to `main.py`.
- **FastAPI HTTPBearer gotcha**: Default `HTTPBearer()` returns 403 when no token is present. Always instantiate with `HTTPBearer(auto_error=False)` and raise an explicit `401` when `credentials is None`.
- **Strict Boundaries**:
  - DO NOT refactor the Auth JWT logic unless explicitly instructed.
  - DO NOT tighten or modify the CORS `allow_origins` during local development tasks.
- **Milestone-Gated Architecture**: Progress = `milestones_completed / milestones_total`. "Achieved"
  only available when all milestones are `is_completed`. AI chooses 3-5 milestones; sprints = 7 days fixed.
- **Background tasks (pre-gen)**: `asyncio.create_task()` coroutines MUST open their own
  `AsyncSession(engine)` — they cannot reuse the closed request session.
- **Gemini**: Use `temperature=1.0` for Gemini 2.5 Flash (required for thinking mode). Pattern:
  `response_mime_type="application/json"` + `response_schema=PydanticModel`.
- **Alembic gotcha**: `Base.metadata.create_all` on startup auto-creates blank tables before
  migrations run, causing `DuplicateTableError`. If this happens: drop the auto-created table,
  then re-run `alembic upgrade head`.
- **No test suite** exists yet.

## Preferred Coding Patterns

- **ESLint impure render**: Never call `Date.now()` or `new Date()` inline inside JSX/map — hoist to a stable `const` at the top of the component render to satisfy the no-impure-functions rule.
- **useEffect + optional chaining**: When `user?.id` is in the dep array, extract `const userId = user?.id` at the top of the effect body and use `userId` inside — avoids `react-hooks/exhaustive-deps` warnings from `user!.id` non-null assertions.
- **FastAPI / SQLAlchemy**: Strictly use asynchronous patterns (`async def`, `AsyncSession`).
- **Queries**: Always prefer SQLAlchemy 2.0 `select()` statements over legacy `.query()`.
- **Execution**: Never use `Session.execute` without an `await`.
- **Atomic Operations**: Always use SQL-level math (e.g., `User.star_points + 10`) for point transactions to prevent race conditions. Do not compute points in memory and save.

## Git conventions

- Branch naming: `feature/<short-description>`
- Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- GitHub Actions: automated Claude code review and PR assistant (`.github/workflows/`)
- Never stage `apps/api/__pycache__/` files — they always appear modified but are compiled bytecode artifacts.
- **Windows bash paths**: Use `/d/PyCharm/goalforge/...` (Unix-style) for Bash `cd` commands — `D:\...` paths fail. Glob/Grep/Read tools accept Windows paths fine.

## Product & UI Philosophy

- **Aesthetic**: "Obsidian Command" — dark mode, `'JetBrains Mono', monospace` for badges/stats/sprint numbers, `'Plus Jakarta Sans', sans-serif` for headings/body. Use full-screen width; avoid restrictive containers that squish the dashboard.
- **Design token pattern**: All fonts and colors are defined in a local `const T = { ... }` object at the top of each component (`Dashboard.tsx`, `Analytics.tsx`, `AppHeader.tsx`, `LandingPage.tsx`). No central theme file — update `T` in each file that needs changing.
- **New page conventions**: New pages should use `min-h-dvh` (not `min-h-screen`) for correct mobile viewport height, and apply `className="mesh-bg"` (defined in `index.css`) for the ambient radial gradient background.
- **Tailwind v4**: No `tailwind.config.js` exists. Theme overrides go in a `@theme {}` block in `src/index.css`. Use `py -3` (not `python3`) on this Windows machine to run Python scripts.
- **Touch targets**: All interactive elements (buttons, icon actions) must have `minHeight: 44, minWidth: 44` for mobile usability.
- **Responsive pattern**: Components use inline `style={}` for design tokens (color, font). Add responsive breakpoints via Tailwind `className` while keeping colors/fonts in `style`. Don't use inline `style` for padding/layout where responsive variants are needed.
- **Anti-Cheat Mechanics**: Gamification must feel earned. Do not implement manual progress sliders. Star brightness should scale gradually based on consecutive daily task completions, not jump to 100% instantly.
- **Goal Status**: Strictly adhere to the "3 A's": `ACTIVE`, `ACHIEVED`, and `ABANDONED`.
