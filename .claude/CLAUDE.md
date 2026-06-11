# GoalForge

AI-powered goal tracker with RPG-style gamification. Users describe a goal in plain language;
Gemini 2.5 Flash converts it into a SMART goal with milestones and a 7-day daily task plan.
Completing tasks and achieving goals earns **star points**, which advance the user through
six evolution stages (Speck → Ember → Flare → Luminary → Nova → Celestial).

## Standing Instructions

- **Always update this file** after completing any feature or fix — add non-obvious patterns, gotchas, and env vars here. Add new files/endpoints to `.claude/REFERENCE.md` (key files tables + API endpoint table). Keep additions to one line per concept.
- Use `/ship` to complete the branch → commit → push → PR → CLAUDE.md update cycle in one command.

## Repo layout

```
apps/
  api/   # Python FastAPI backend (async)
  web/   # React 19 + TypeScript + Vite frontend
```

## Docker (production)

```bash
docker compose down && docker compose build --no-cache && docker compose up -d  # full rebuild
docker compose build web && docker compose up -d web  # frontend-only rebuild
docker compose exec api alembic upgrade head          # run migrations (use this, not local py -3 -m alembic)
```

- **`DATABASE_URL` host differs**: Docker uses `@db:5432`; local uvicorn uses `@localhost:5432`. Shared `.env` — switch when toggling.

## Backend — apps/api/

### Setup

```bash
cd apps/api && pip install -r requirements.txt && cp .env.example .env
py -3 -m alembic upgrade head                              # run all migrations (Windows: alembic not on PATH)
py -3 -m alembic revision --autogenerate -m "description"  # generate migration
```

**Required env vars** (`.env`):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/goalforge` |
| `GEMINI_API_KEY` | Google AI Studio key |
| `CLERK_JWKS_URL` | `https://<clerk-domain>.clerk.accounts.dev/.well-known/jwks.json` |
| `CLERK_SECRET_KEY` | `sk_test_...` from Clerk dashboard |
| `RATE_LIMIT_ENABLED` | `false` — disable in tests/local dev |
| `JOBS_API_KEY` | Required; 401 if unset; no dev bypass |
| `RESEND_API_KEY` | If empty, emails are logged instead of sent |
| `DEV_EMAIL_OVERRIDE` | Routes all Resend emails to this address |
| `ENVIRONMENT` | `production` — enables JSON structured logging |
| `CORS_ORIGINS` | `http://localhost:5173` — comma-separated |
| `VAPID_PRIVATE_KEY` | Web push private key (`npx web-push generate-vapid-keys`) |
| `VAPID_SUBJECT` | e.g. `mailto:admin@goalforge.app` |
| `VITE_VAPID_PUBLIC_KEY` | Baked into frontend at build time; requires `docker compose build web` after change |

DB pool tuning (`DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT`, `DB_POOL_RECYCLE`) — see `.claude/REFERENCE.md`.

### Run

```bash
uvicorn main:app --reload --port 8000
```

### Key files

See `.claude/REFERENCE.md` for the full table. Non-obvious entries:

| File | Purpose |
|---|---|
| `deps.py` | Shared ownership helpers + `get_or_create_user`. Import from here; do NOT redefine inline. |
| `rate_limiting.py` | `rate_limit()` + `_user_key()` — imported by route modules to avoid circular imports with `main.py` |
| `services/task_service.py` | `create_sprint_tasks(...)` — use for any new sprint task write loop; `compute_adaptive_difficulty_mode()` |
| `services/goal_service.py` | `PLACEHOLDER_MILESTONE_TITLE` sentinel; `_generate_goal_async` background task |
| `services/reward_service.py` | `award_reward(...)` — atomically awards ⭐; `pick_collectible()` |
| `ai_utils.py` | All Gemini calls via `_with_retry()` — do not call `generate_content` directly |
| `routes/jobs.py` | Cron endpoints — `X-Api-Key` auth only, no Clerk JWT |
| `startup.py` | `validate_startup()` — called in lifespan, exits on missing required env vars |
| `routes/health.py` | `/health` (liveness), `/health/ready` (DB probe), `/health/info` |

### API endpoints

See `.claude/REFERENCE.md` for the full table. Key non-obvious facts:

- **Goal creation is async (202)**: Gemini runs in background; milestone `sprint_status` goes `generating` → `ready|failed`
- **Goals list is paginated**: `{items, total, limit, offset}` — Dashboard limit=20, Analytics limit=100
- **Task completion awards variable ⭐**: standard +10, bonus +15, crit +25, jackpot +50; returns `TaskCompleteResponse`
- **Rate limits**: goal creation 5/min, task regenerate 10/min, milestone complete 10/min, star-log 10/hour, energy-resize 3/hour
- **Jobs endpoint**: `X-Api-Key` only — no Clerk JWT, 401 if `JOBS_API_KEY` unset

### Data model

See `.claude/REFERENCE.md` for full schema. Key non-obvious facts:
- `milestone.sprint_status`: `pending|generating|ready|active|completed|failed`
- `daily_tasks.original_description` / `original_tip`: set on energy resize, cleared on restore
- `rewards`: NO `display_name` column — comes from `reward_service.REWARD_REGISTRY` at runtime
- `GoalResponse` computed fields: `completed_days`, `milestones_completed`, `milestones_total`

### Adding new endpoints

Use `APIRouter()` in the appropriate `routes/*.py`. Rate-limited routes import `rate_limit` + `_user_key` from `rate_limiting.py`. Include router in `main.py` via `app.include_router(...)`.

## Frontend — apps/web/

### Setup & Commands

```bash
cd apps/web && npm install
npm run dev      # → http://localhost:5173
npm run build    # TypeScript check + Vite build
npm run test:e2e  # Playwright (do NOT start dev server manually — playwright.config.ts handles it)
npx tsc --noEmit  # fast type-check; run after every edit
```

`apps/web/.env.local`: `VITE_CLERK_PUBLISHABLE_KEY=pk_...` (required), `VITE_API_BASE_URL=http://localhost:8000` (optional).

### Key files

See `.claude/REFERENCE.md` for the full table. Non-obvious entries:

| File | Purpose |
|---|---|
| `src/pages/Dashboard.tsx` | Mutation prop lifting hub — overlays receive mutations as props, do NOT call `useGoalMutations` internally |
| `src/components/GoalCard.tsx` | Smart parent — calls `useGoalMutations` directly; `onJackpot` threaded as prop |
| `src/components/AuthInterceptor.tsx` | Bridges Clerk `useAuth()` → axios interceptor via `useRef` (token can't be used at module level) |
| `src/components/AppHeader.tsx` | Theme CSS class on `<body>` via `THEME_KEY_TO_CLASS`; add new pages to nav array here |
| `src/hooks/useGoalMutations.ts` | All 12 Dashboard mutations with optimistic updates — authoritative cache owner |
| `src/lib/theme.ts` | Design tokens (`const T`) — update here only, never redefine locally |
| `src/lib/pickOneThing.ts` | Excludes future tasks intentionally (anti-exploit) — do not change |
| `src/lib/types.ts` | Shared TS interfaces — `Goal`, `Task`, `Reward`, etc. |
| `src/lib/ThemeContext.tsx` | `ThemeProvider` stub — applies `.dark` class to `<html>`; replace when full toggle ships |
| `src/components/OnboardingGuard.tsx` | Redirects to `/onboarding` if `goalforge_onboarding_complete` not in localStorage |
| `src/pages/Onboarding.tsx` | 4-step wizard; passes goal text to Dashboard via `?goal=` query param |

## Architecture notes

- **React Query**: `staleTime: 60s`. `queryKeys.goals(userId)` invalidates all goal queries. Most mutations use `setQueryData` over `invalidateQueries`. Overlays/modals must NOT call `useGoalMutations` — Dashboard's instance is the authoritative cache owner.
- **Auth interceptor**: Clerk `getToken()` can't be at module level — `AuthInterceptor` bridges via `useRef` + `useEffect` → axios interceptor.
- **AI flow (two-phase)**: `POST /goals` saves placeholder Milestone (`sprint_status=generating`), returns 202. Background task replaces it. On failure: `sprint_status=failed`; retry via `POST /milestones/{id}/retry-generation`.
- **`completed_days`**: `@computed_field` on `GoalResponse` — sorted unique ISO dates from completed tasks. Source of truth for `streak()` + `starBrightness()` on frontend.
- **Star points**: SQL atomic update (`star_points = star_points + N`). +100 on first achievement gated by `achievement_reward_granted` — NOT `old_status != "achieved"` (prevents cycling).
- **DB session**: `get_db()` auto-commits/rolls back. Do NOT `await db.flush()` in mutating routes — redundant and misleading.
- **`get_or_create_user` in `deps.py`**: import ONLY from `deps`, never from `routes.goals`. Use for any route handling first API calls from new Clerk accounts (404s otherwise).
- **Cross-route imports forbidden**: shared helpers go in `deps.py` or `services/`. Never `from routes.X import Y`.
- **`HTTPBearer` gotcha**: Use `HTTPBearer(auto_error=False)` and raise explicit `401` when `credentials is None` (default raises 403).
- **Rate limiting**: `slowapi`, global 100/min. Rate-limited endpoints need `request: Request` as first param. `rate_limit()` is a no-op when `RATE_LIMIT_ENABLED=false`.
- **Row locking**: `complete_milestone` + `retry_sprint_generation` use `.with_for_update()`. Any new milestone-status mutation must follow this pattern.
- **Background tasks**: `asyncio.create_task()` coroutines MUST open their own `AsyncSession(engine)`. Attach `_log_task_exception` done-callback BEFORE any discard callback. Store refs in module-level `set[asyncio.Task]`.
- **Timezone**: Use `user_today(user.timezone)` from `utils.py` instead of `date.today()`. Background tasks load user row themselves. Frontend: `new Intl.DateTimeFormat('en-CA').format(new Date())` for YYYY-MM-DD; use `daysAgo(dateStr, n)` helper for DST-safe arithmetic.
- **`zoneinfo`**: requires `tzdata>=2024.1` in `requirements.txt` (Windows + slim Docker). Guard with `except (ZoneInfoNotFoundError, KeyError, TypeError)`.
- **Gemini**: `temperature=1.0` (required for thinking mode), `response_mime_type="application/json"` + `response_schema=PydanticModel`. All calls via `_with_retry()` with 30s timeout.
- **Alembic**: see `.claude/REFERENCE.md` for migration gotchas (autogenerate, CheckConstraint, revision collisions, broken chain repair, catch-up pattern).
- **Running tests**: `GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest apps/api/tests/ -v`. See REFERENCE.md for test gotchas (mock paths, auth override, SQLite pool, cross-dialect insert, CI hang fix).
- **ORM cascade**: Tables with `user_id` FK need BOTH `ondelete="CASCADE"` on the FK AND `cascade="all, delete-orphan"` on `User.relationship()`. DB-level cascade alone insufficient for `db.delete(user)`.
- **SQLAlchemy identity map**: `selectinload` skips re-query on loaded collections within same session. Fix stale data: `await db.refresh(instance, attribute_names=["rel"])`. Never `db.expire()` in async context (raises `MissingGreenlet`).
- **Energy resize**: discard `result.assigned_date` from `resize_task_for_low_energy()` — only write `description` + `tip`. Parallel calls: `asyncio.Semaphore(5)` + `gather(..., return_exceptions=True)`.
- **Worktree node_modules (Windows)**: `New-Item -ItemType Junction -Path '.worktrees/<branch>/apps/web/node_modules' -Target 'apps/web/node_modules'`.
- **Merging PRs**: `gh pr merge <number> --squash --delete-branch`. MCP merge tool returns 403. Pull from main dir — `git checkout main` fails from inside a worktree.
- **Docker alembic**: `docker compose exec api alembic upgrade head` — never run `py -3 -m alembic` locally when `.env` has `@db:5432`; it will fail DNS lookup.
- **Docker hot-patch**: `docker compose cp <file> api:/app/<file> && docker compose restart api` applies a single-file fix without a full `docker compose build`.
- **Sequential PR merges**: merging multiple PRs that touch the same file (e.g. `main.py`) causes conflicts on later PRs — resolve locally: `git checkout <branch> && git merge origin/main`, fix markers, push, retry `gh pr merge`.
- **MCP `push_files` ≠ conflict resolution**: pushing a resolved file via GitHub MCP doesn't fix git 3-way conflicts — GitHub still reports the PR as conflicted. Must resolve locally.
- **Strict Pydantic Literals on response schemas**: always pair with a `field_validator(mode='before')` normalizer — without it, legacy DB rows with old enum values cause 500s on every read.
- **E2E**: `VITE_E2E_MODE=true` disables AuthGuard/Clerk. Kill stale Vite on Windows: `cmd /c "taskkill /F /IM node.exe"`. After task complete, `aria-label` → `'Task completed'`; use `toHaveCount(N)` guard. `GET /goals` mock threshold `>= 3` (not 2) to absorb React Query duplicates.
- **Push service**: hard-deletes subscription row on 410/404. Falls back to logging when `VAPID_PRIVATE_KEY` unset. VAPID key pair (`PRIVATE_KEY` + `VITE_VAPID_PUBLIC_KEY`) are cryptographic pair — regenerating one invalidates all existing subscriptions.
- **Sunday Star Log push**: Sundays at `user.reminder_hour` sends star log teaser instead of digest. Priority: Streak-Saver > Inactivity Nudge > Star Log > Digest. Dedup via `notification_logs` type `"weekly_star_log"`.
- **Adaptive sprint difficulty**: `compute_adaptive_difficulty_mode()` → `lighter|balanced|stretch` from 14-day completion rate. No DB column — computed at runtime. Passed into `generate_sprint_tasks()`.
- **Coach Forge**: `POST /coach/sessions/start` idempotent. After 5 answers creates Goal synchronously (not background). Use `await db.refresh(session, attribute_names=["messages"])` to avoid selectinload stale cache bug.
- **Accountability invite matching**: `GET /overview` ORs on `(invitee_user_id == user_id) OR (target_email == real_email)` — backfills `invitee_user_id` on match.
- **User deletion self-healing**: `GET /profile` + `GET /settings` auto-create User row if missing. Other endpoints 404.
- **`settings` import in main.py**: NOT imported by default — add `from config import settings` explicitly.
- **Rescue loop**: `goal.rescue_mode && !isGenerating` → GoalCard shows rescue card instead of SprintRail. Dismiss stored in `localStorage` with 8h TTL.
- **Dashboard inline nudges**: `WelcomeBackCard` (3+ days inactivity) dismiss: `localStorage` 24h TTL. Use lazy `useState` initializer to read — avoids `useEffect` + `setState` lint.
- **Badge confetti**: `completeTask.onSuccess` MUST invalidate `queryKeys.badges(userId)` — without it confetti fires on focus, not immediately.
- **WSL relay port conflict**: `wslrelay.exe` can bind `[::1]:5173`. Diagnose: `netstat -ano | findstr ":5173.*LISTENING"`. Fix: `Stop-Process -Id <PID> -Force`.
- **pip install quoting**: `py -3 -m pip install "pkg>=ver"` — unquoted `>=` creates junk files.
- **`/db-migrate "<message>"`**: skill that runs `alembic revision --autogenerate` + `upgrade head`.
- **`/gen-test`**: skill that generates a pytest-asyncio test file following GoalForge patterns.
- **PWA**: Bump `CACHE_VERSION` in `public/sw.js` to purge stale caches on deploy. `/api/*` network-only; `/assets/*` stale-while-revalidate. Generate icons: `cd apps/web && node scripts/generate-icons.mjs` (requires `sharp`).
- **`git rm --cached` + merge**: deletes working tree files on `git pull`. Back up local-only files first.
- **Structured logging**: `python-json-logger`, JSON in production. `request_id_var` ContextVar injects UUID per request; `X-Request-ID` added to all responses.

## Preferred Coding Patterns

- **dnd-kit `useSortable`**: `disabled` prop doesn't remove DndContext dependency — always render inside `<DndContext><SortableContext>`.
- **TypeScript closure narrowing**: outer null guards don't flow into nested functions — add `if (!x) return` inside closures too.
- **ESLint impure render**: `Date.now()` / `new Date()` banned in render body (including `useMemo`/`useRef(init)`). Compute in `useEffect`, store in state/ref.
- **ESLint `react-hooks/set-state-in-effect`**: use lazy `useState(() => sessionStorage.getItem(...))` or extract a sub-component that receives loaded data as props.
- **ESLint unused params**: drop trailing unused params — prefixed `_vars` still fail `no-unused-vars`.
- **JSX apostrophe**: double quotes for strings with apostrophes: `"today's tasks"`.
- **`useEffect` + optional chaining**: extract `const userId = user?.id` at effect body top; avoids `user!.id` exhaustive-deps warnings.
- **FastAPI/SQLAlchemy**: `async def` + `AsyncSession`. SQLAlchemy 2.0 `select()`. Atomic SQL math for point transactions.
- **Removing auth bypasses**: grep for tests that relied on the bypass and update them in the same commit.

## Git conventions

- **Always branch, never commit to main** — `feature/`, `fix/`, `refactor/`; merge via `gh pr merge <number> --squash --delete-branch` after CI passes.
- Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`)
- Never stage `apps/api/__pycache__/` — always appears modified.
- **Windows bash paths**: `/d/PyCharm/goalforge/...` (Unix-style) for Bash `cd` — `D:\...` fails.

## Product & UI Philosophy

- **Aesthetic**: "Obsidian Command" — dark, `'JetBrains Mono'` for badges/stats/numbers, `'Plus Jakarta Sans'` for body. Full-screen width.
- **Design tokens**: `const T` in `src/lib/theme.ts` — update here only, never redefine in components. New pages: `min-h-dvh` + `className="mesh-bg"`. Add to nav array in `AppHeader.tsx`.
- **Tailwind v4**: `@theme {}` block in `src/index.css`. No `tailwind.config.js`. Touch targets: `minHeight: 44, minWidth: 44`. CSS animations: `@keyframes` in `index.css`; never inline.
- **Anti-cheat**: No manual progress sliders. Future tasks excluded from Focus mode (`pickOneThing`). `achievement_reward_granted` gates +100 (prevents active→achieved cycling). User-added tasks (`is_user_added=true`) → 0 pts, no drop.
- **Goal Status**: "3 A's" only: `ACTIVE`, `ACHIEVED`, `ABANDONED`.
