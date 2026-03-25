# GoalForge

AI-powered goal tracker with RPG-style gamification. Users describe a goal in plain language;
Gemini 2.5 Flash converts it into a SMART goal with milestones and a 7-day daily task plan.
Completing tasks and achieving goals earns **star points**, which advance the user through
six evolution stages (Speck → Ember → Flare → Luminary → Nova → Celestial).

## Standing Instructions

- **Always update this file** after completing any feature or fix — add new files to key file tables, new endpoints to the API table, new env vars, and any non-obvious patterns discovered. Keep additions to one line per concept.
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
docker compose build web && docker compose up -d web  # frontend-only rebuild (faster; no --no-cache needed for source changes)
```

- **API**: `python:3.12-slim`, runs as `appuser` (non-root), `uvicorn --workers 4` (no `--reload`)
- **Web**: Multi-stage — `node:20-alpine` builds Vite app, `nginx:alpine` serves `dist/`. Runs as `appuser` on port 8080 internally, mapped to `5173` on host.
- **`apps/web/nginx.conf`**: SPA routing (`try_files $uri $uri/ /index.html`), listens on 8080.
- **`.dockerignore`** files in both `apps/api/` and `apps/web/` exclude `.venv`, `.git`, `__pycache__`, `node_modules`, etc.
- **DB**: `postgres:16-alpine` with `pgdata` named volume.
- **`DATABASE_URL` host differs**: Docker uses `@db:5432` (service name); local uvicorn uses `@localhost:5432`. The `.env` is shared — switch the host when toggling between Docker and local dev.

## Backend — apps/api/

### Setup

```bash
cd apps/api
pip install -r requirements.txt
cp .env.example .env   # fill in values
py -3 -m alembic upgrade head                              # run all migrations (Windows: alembic not on PATH)
py -3 -m alembic revision --autogenerate -m "description"  # generate migration
```

**Required env vars** (`.env`):

| Variable | Example / notes |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/goalforge` |
| `GEMINI_API_KEY` | Google AI Studio key |
| `DEBUG` | `false` (optional) |
| `CLERK_JWKS_URL` | `https://<your-clerk-domain>.clerk.accounts.dev/.well-known/jwks.json` |
| `CLERK_SECRET_KEY` | Clerk secret key (`sk_test_...` from Clerk dashboard) |
| `RATE_LIMIT_ENABLED` | `false` — set to disable rate limiting in tests/local dev (default: `true`) |
| `JOBS_API_KEY` | Required — jobs endpoint always returns 401 if unset; no dev bypass. Set to any secret string locally. |
| `DB_POOL_SIZE` | `10` — SQLAlchemy connection pool size |
| `DB_MAX_OVERFLOW` | `20` — max connections above pool_size |
| `DB_POOL_TIMEOUT` | `30` — seconds to wait for a connection |
| `DB_POOL_RECYCLE` | `1800` — recycle connections after N seconds |
| `RESEND_API_KEY` | Resend API key — if empty, emails are logged instead of sent |
| `DEV_EMAIL_OVERRIDE` | If set, all Resend emails route to this address (bypasses Resend testing-tier restriction) |
| `ENVIRONMENT` | `production` — enables JSON structured logging; omit for human-readable dev logs |
| `CORS_ORIGINS` | `http://localhost:5173` — comma-separated allowed origins for CORS |

Tables are also auto-created on startup via `Base.metadata.create_all` (dev convenience only —
use Alembic for schema changes).

### Run

```bash
uvicorn main:app --reload --port 8000
```

### Key files

| File | Purpose |
|---|---|
| `main.py` | FastAPI app shell: lifespan, middleware, rate limiting setup, health endpoint, router inclusion (~140 lines) |
| `rate_limiting.py` | `rate_limit()` decorator + `_user_key()` — imported by route modules to avoid circular imports with `main.py` |
| `routes/users.py` | User profile + settings endpoints |
| `routes/goals.py` | Goal CRUD + `get_or_create_user()` helper |
| `deps.py` | Shared FastAPI helpers — `_load_goal_with_ownership(goal_id, current_user_id, db)`. Import from here in any new route; do NOT redefine inline. |
| `routes/tasks.py` | Task CRUD, complete, reorder, regenerate endpoints |
| `routes/milestones.py` | Sprint advancement + retry-generation endpoints |
| `routes/jobs.py` | Background job trigger endpoints (no Clerk auth — uses X-Api-Key header) |
| `services/task_service.py` | Task completion, background sprint pre-gen, `create_sprint_tasks(db, goal_id, milestone_id, task_outputs, start_date)` — use for any new sprint task write loop |
| `services/goal_service.py` | `_generate_goal_async` — Phase 2 background goal generation; `PLACEHOLDER_MILESTONE_TITLE` sentinel constant used by retry routing |
| `services/email_service.py` | Resend daily digest (`send_reminder_digest`, `TaskDigestItem`, `_build_digest_html`); falls back to logging when `RESEND_API_KEY` is unset |
| `services/rescue_service.py` | `goal_is_rescue_mode(goal)` — pure ORM-level rescue check; `_execute_rescue_sprint` — generates 2 rescue tasks and saves them |
| `services/reward_service.py` | `award_reward(user_id, tier, collectible, db)` — atomically awards ⭐ + optional collectible; `pick_collectible(tier, user_id, db)` — selects random uncollected reward from registry |
| `routes/rewards.py` | `GET /users/{user_id}/rewards` — list user's rewards; `PATCH /rewards/{reward_id}/equip` — equip a title/theme/lore |
| `routes/energy.py` | `POST /users/{user_id}/energy-resize` (bulk resize, 3/hour) + `POST /tasks/{task_id}/restore` (undo resize) |
| `ai_utils.py` | `generate_smart_goal()`, `generate_sprint_tasks()`, `regenerate_single_task()`, `resize_task_for_low_energy()`, `_with_retry()` — Gemini structured-output calls with retry + timeout |
| `exceptions.py` | `AIGenerationError` — raised by `_with_retry()` on final failure |
| `models.py` | SQLAlchemy ORM: `User`, `Goal`, `Milestone`, `DailyTask`, `Reward` |
| `schemas.py` | Pydantic I/O models + internal `AIGoalOutput` / `AITaskOutput` |
| `database.py` | Async engine + `get_db()` session dependency |
| `config.py` | Pydantic Settings (reads `.env`) |
| `auth.py` | JWT auth dependencies: `get_current_user_id`, `get_current_user_email` |

### API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/users/{user_id}/profile` | Returns `star_points` for user |
| `GET` | `/users/{user_id}/settings` | Returns `UserProfileResponse` (id, email, star_points, timezone, display_name) |
| `PATCH` | `/users/{user_id}/settings` | Update `timezone` and/or `display_name` — returns updated `UserProfileResponse` |
| `POST` | `/users/{user_id}/goals` | Create SMART goal via Gemini (upserts user row) |
| `GET` | `/users/{user_id}/goals` | List user's goals — returns `PaginatedGoalsResponse` (`items`, `total`, `limit`, `offset`); supports `?limit` (1–100, default 20) and `?offset` (default 0) |
| `GET` | `/goals/{goal_id}` | Get single goal with tasks |
| `PATCH` | `/goals/{goal_id}` | Update status (`active` / `achieved` / `abandoned`) — awards **+100 ⭐** on first achievement |
| `PATCH` | `/goals/{goal_id}/progress` | Set progress `0–100` |
| `DELETE` | `/goals/{goal_id}` | Permanently delete goal + all its tasks |
| `GET` | `/goals/{goal_id}/tasks` | List tasks (optional `?assigned_date=YYYY-MM-DD`) |
| `PATCH` | `/tasks/{task_id}/complete` | Mark task done — awards variable ⭐ via `reward_service` (standard +10, bonus +15, crit +25, jackpot +50); returns `TaskCompleteResponse` with `reward_drop` |
| `PATCH` | `/tasks/{task_id}` | Update pending task description |
| `DELETE` | `/tasks/{task_id}` | Delete pending task |
| `POST` | `/goals/{goal_id}/tasks` | Add custom task to active sprint (auto-assigns milestone + today) |
| `PUT` | `/goals/{goal_id}/tasks/reorder` | Bulk-update task positions |
| `POST` | `/tasks/{task_id}/regenerate` | AI-regenerate a task's description + tip via Gemini |
| `GET` | `/health` | Health check (hidden from OpenAPI docs) |
| `POST` | `/goals/{goal_id}/milestones/{milestone_id}/complete` | Mark sprint done, unlock next sprint |
| `POST` | `/goals/{goal_id}/milestones/{milestone_id}/retry-generation` | Retry AI task generation for failed/empty sprint (5/min rate limit) |
| `POST` | `/goals/{goal_id}/rescue` | Trigger a Recovery Sprint for a stalled goal (202); sets milestone to `generating`, runs `_execute_rescue_sprint` in background |
| `GET` | `/users/{user_id}/rewards` | List all rewards earned by user (titles, themes, lore entries) |
| `PATCH` | `/rewards/{reward_id}/equip` | Toggle equip on a collectible reward (title, theme, lore) |
| `POST` | `/api/jobs/trigger-reminders` | Send daily reminder digest (one per user) for today's pending tasks — secured via `X-Api-Key` header (`JOBS_API_KEY` env var; always required — 401 if unset) |
| `POST` | `/users/{user_id}/energy-resize` | Bulk-resize all today's pending tasks into 3-min first steps via Gemini (3/hour; idempotent; cap 10; `asyncio.gather` with semaphore(5)); returns `EnergyResizeResponse` |
| `POST` | `/tasks/{task_id}/restore` | Restore a resized task to its original description/tip; 400 if not resized or completed; returns `TaskResponse` |

CORS origins configured via `cors_origins` setting (default: `http://localhost:5173`). Tighten before deploying.

### Data model

```
users          id (Clerk user_id), email (unique=True), star_points, timezone (default "UTC"), display_name (nullable), created_at
goals          id (uuid), user_id → users, raw_input, smart_title, smart_description,
               goal_type, target_date, status, progress (0-100), created_at
milestones     id (uuid), goal_id → goals, title, position, is_final, sprint_theme,
               sprint_status (pending|generating|ready|active|completed|failed),
               generation_started_at (nullable timestamptz — set when transitioning to generating),
               is_completed, completed_at, created_at
daily_tasks    id (uuid), goal_id → goals, milestone_id → milestones (nullable),
               description, tip, assigned_date, position (int, default 0),
               is_completed, completed_at, is_rescue_task (bool, default false),
               original_description (nullable varchar), original_tip (nullable varchar) — set on energy resize, cleared on restore
rewards        id (uuid), user_id → users, reward_key (unique per user), reward_type
               (title|theme|lore), display_name, lore_text, tier (crit|jackpot),
               is_equipped (bool), earned_at
```

`GoalResponse` computed fields: `completed_days`, `milestones_completed`, `milestones_total`.

### Adding new endpoints

Create routes in the appropriate `routes/*.py` file using `APIRouter()`. Rate-limited routes import `rate_limit` and `_user_key` from `rate_limiting.py`. Include the router in `main.py` via `app.include_router(router, tags=[...])`.

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
npx tsc --noEmit  # fast type-check without building — run after every edit; use npm run build when tsc --noEmit passes but CI fails
```

### Routes

| Path | Component | Auth |
|---|---|---|
| `/` | `LandingPage` | public |
| `/sign-in` | `SignInPage` | public |
| `/sign-up` | `SignUpPage` | public |
| `/dashboard` | `Dashboard` | `AuthGuard` |
| `/analytics` | `Analytics` | `AuthGuard` |
| `/settings` | `Settings` | `AuthGuard` |

`AuthGuard` (in `App.tsx`) redirects signed-out users to `/sign-in`.

### Key files

| File | Purpose |
|---|---|
| `src/main.tsx` | Entry — `ClerkProvider` → `QueryClientProvider` → `AuthInterceptor` + `App` |
| `src/App.tsx` | Router + `AuthGuard` component |
| `src/pages/Dashboard.tsx` | Main view: goals, daily tasks, gamification UI — uses `useGoalsQuery`, `useProfileQuery`, `useGoalMutations` hooks. `EmptyState` stays inline. `AddGoal` is a controlled component (`value`/`onChange` props). |
| `src/pages/Analytics.tsx` | Goal analytics and progress charts |
| `src/pages/Settings.tsx` | User preferences — `SettingsForm` sub-component mounts only when data is loaded (avoids setState-in-effect lint). Uses `useSettingsQuery`, `useSaveSettingsMutation`. |
| `src/components/AppHeader.tsx` | Shared header with nav, user info, equipped title badge, relics count button, and theme CSS class injection on `<body>` via `THEME_KEY_TO_CLASS` map; accepts `onOpenCollection?: () => void` prop |
| `src/components/GamificationSvgs.tsx` | SVG assets for star evolution stages |
| `src/components/TodayBar.tsx` | Daily progress summary bar — overdue-aware, shows catch-up count; renders ⚡ Focus button when `pickOneThing` finds an actionable task; 🌙 Low energy button when `onEnergyOpen` prop provided + pending tasks exist |
| `src/components/FocusOverlay.tsx` | Full-screen Focus overlay — two phases (focus → done); accepts `completeTask` as prop from Dashboard, does NOT call `useGoalMutations` internally |
| `src/components/AddGoal.tsx` | Controlled textarea form for creating new goals via AI |
| `src/components/GoalCard.tsx` | Smart parent for a single goal — calls `useGoalMutations(goal.user_id, onJackpot)` directly; props: `{ goal: Goal; onJackpot?: (drop: RewardDrop) => void }`. Renders SprintRail, DailyTaskList, GoalHeatmap. |
| `src/components/SprintRail.tsx` | Milestone dot progression rail — shows sprint N of M with active/completed/pending/failed dots + retry button for failed sprints |
| `src/components/DailyTaskList.tsx` | DnD task list with unified `TaskRow` (`draggable?`/`dateLabel?` props) + collapsible catch-up section, inline edit/add/regenerate/restore; manages its own editing + add-task state internally |
| `src/components/EnergyModal.tsx` | Full-screen modal for low-energy mode — accepts `onConfirm`/`onDismiss`/`isLoading` from Dashboard (mutation-prop-lifting pattern); does NOT call hooks internally |
| `src/components/EnergyParamCapture.tsx` | Renders null; captures `?energy=low` from URL into `sessionStorage` before Clerk auth redirect strips the param |
| `src/components/GoalHeatmap.tsx` | Completion history section — wraps `Heatmap` from `GamificationSvgs` with label |
| `src/components/AuthInterceptor.tsx` | Renders null — installs axios request interceptor that injects Clerk JWT via `useRef` bridge pattern |
| `src/components/ui/Btn.tsx` | Reusable button atom — variants: primary, ghost, danger, success |
| `src/components/ui/Badge.tsx` | Reusable pill badge atom with configurable color |
| `src/hooks/useGoals.ts` | `useGoalsQuery(userId)` — Dashboard goals (limit=20), returns `{ goals, isLoading, isError, refetch }` |
| `src/hooks/useAllGoals.ts` | `useAllGoalsQuery(userId)` — Analytics goals (limit=100) |
| `src/hooks/useProfile.ts` | `useProfileQuery(userId)` — star_points, shared cache across all pages |
| `src/hooks/useSettings.ts` | `useSettingsQuery` + `useSaveSettingsMutation` — Settings page data |
| `src/hooks/useGoalMutations.ts` | All 12 Dashboard mutations with optimistic updates + cache manipulation |
| `src/hooks/useRewards.ts` | `useRewardsQuery(userId)` — fetches user's reward collection; `useEquipRewardMutation(userId)` — equips a collectible or theme |
| `src/hooks/useEnergyMutations.ts` | `useEnergyResizeMutation(userId)` — `POST /users/{userId}/energy-resize`; `useTaskRestoreMutation(userId)` — `POST /tasks/{taskId}/restore`; both invalidate goals cache |
| `src/components/RewardModal.tsx` | Full-screen modal shown on crit/jackpot drop — displays reward name, lore, tier; Equip button for collectibles/themes |
| `src/components/CollectionModal.tsx` | "Trophy Room" overlay — shows all unlocked titles, themes, lore entries; grouped by type with locked slot placeholders; equip from here |
| `src/lib/api.ts` | Axios client — auth injection handled by `AuthInterceptor`, not `api.ts` |
| `src/lib/queryClient.ts` | TanStack QueryClient — staleTime 60s, gcTime 5min |
| `src/lib/queryKeys.ts` | Query key factories: `queryKeys.goals(userId, params?)`, `.profile(userId)`, `.settings(userId)` |
| `src/lib/gamification.ts` | Stage thresholds, `getStage()`, streak calc, star brightness |
| `src/lib/pickOneThing.ts` | Selects the single highest-priority incomplete task for Focus mode — excludes future tasks intentionally (anti-exploit) |
| `src/lib/celebrations.ts` | `triggerCelebration('task' \| 'sprint' \| 'goal')`, `triggerCritCelebration()` (purple confetti), `triggerJackpotCelebration()` (fireworks) — canvas-confetti tiered celebrations |
| `src/lib/types.ts` | Shared TypeScript interfaces: `Goal` (incl. `rescue_mode`), `Milestone`, `Task` (incl. `is_rescue_task`, `original_description`, `original_tip`), `UserSettings`, `PaginatedGoalsResponse`, `Reward`, `RewardDrop`, `RewardTier`, `TaskCompleteResponse`, `EnergyResizeResponse` |

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

Key exports: `getStage(pts)`, `getNext(pts)`, `stagePct(pts)`, `streak(days)`, `starBrightness(days)`, `lastStreakLength(days)`, `daysAgo(dateStr, n)`.
`starBrightness` uses a recency-weighted rolling 7-day window (today=7, yesterday=6, …, 6 days ago=1; total=28). Missing a day costs ~15-25% instead of resetting to 0.

## Architecture notes

- **React Query (TanStack Query v5)**: All API data fetching uses `@tanstack/react-query`. Queries in `src/hooks/`, QueryClient in `src/lib/queryClient.ts`, key factories in `src/lib/queryKeys.ts`. `staleTime: 60s` means navigating between pages serves cached data. Profile (`star_points`) is shared across all pages via same cache key.
- **Auth interceptor pattern**: Clerk's `getToken()` comes from `useAuth()` hook — can't be used at module level. `AuthInterceptor` component uses `useRef` + `useEffect` to bridge React hooks → axios request interceptor. Token is injected per-request, never stale.
- **Mutation conventions**: Optimistic mutations use `onMutate` for instant UI + `onError` for rollback. Fire-and-forget mutations (`completeTask`, `reorderTasks`) call `mutation.mutate()`. Mutations needing `Promise<void>` (e.g., in async onClick handlers like completeMilestone) must wrap `mutateAsync` with `async (): Promise<void> => { await ... }` since `mutateAsync` returns the data type.
- **Query key invalidation**: `queryKeys.goals(userId)` (no params) invalidates all goal queries. Most mutations use direct `setQueryData` instead of `invalidateQueries` to avoid extra network round-trips.
- **GoalCard smart parent**: `GoalCard` calls `useGoalMutations(goal.user_id)` internally — `Dashboard` only passes `{ goal }`. Multiple hook instances across cards share the same QueryClient cache correctly. Editing/add-task state lives in `DailyTaskList` (per-card), not Dashboard. **Callback threading**: any callback passed to `useGoalMutations` in Dashboard (e.g. `onJackpot`) does NOT reach GoalCard's instance — add the callback as a prop to GoalCard and thread it through to its `useGoalMutations` call.
- **Mutation prop lifting for overlays**: Components rendered inside Dashboard (overlays, modals) must NOT call `useGoalMutations` internally — accept `completeTask` (or similar) as a prop from Dashboard. Dashboard's mutation instance is the authoritative cache owner; a second instance in a child creates subtle cache-update ordering bugs.
- **Task completion flow**: `completeTask` in `useGoalMutations` uses React Query's `onMutate` for optimistic cache update + toast + confetti, then `api.patch` in background. `onError` rolls back cache. Sprint/goal celebrations wired similarly in `completeMilestone`/`changeStatus` mutations.
- **`completed_days` (source of truth for gamification)**: `@computed_field` on `GoalResponse` in `schemas.py` — sorted unique ISO dates derived from `daily_tasks`. Drives both `streak()` (strict consecutive, used for badge) and `starBrightness()` (rolling window) on the frontend.
- **AI flow (two-phase)**: `POST /users/{user_id}/goals` → saves placeholder `Goal` + `Milestone` (sprint_status=`generating`) → returns **202** immediately. Background task (`_generate_goal_async` in `services/goal_service.py`) calls Gemini, replaces placeholder with real milestones + sprint-1 tasks. On failure: sets milestone `sprint_status=failed`; retry via `POST /goals/{goal_id}/milestones/{milestone_id}/retry-generation`.
- **Star points**: awarded atomically via SQL `UPDATE ... SET star_points = star_points + N`
  to avoid race conditions. Variable per completed task (standard +10, bonus +15, crit +25, jackpot +50) via `reward_service.award_reward()`; +100 on first goal achievement.
- **DB session**: all handlers inject `db: AsyncSession = Depends(get_db)`. Sessions auto-commit on success and roll back on exception. Do NOT add `await db.flush()` to mutating routes — it sends SQL within the open transaction but does NOT commit; it's redundant and misleading. Let `get_db()` handle commit/rollback.
- **User resolution & Auth**: `get_or_create_user()` in `routes/goals.py` upserts a `User` row using the Clerk `user_id` path param. **Note:** The `user_id` is a Clerk string (e.g., `user_2...`), NOT a UUID. Email is extracted from the JWT payload; if absent, a unique placeholder `{sub}@placeholder.goalforge.app` is used to avoid violating `User.email`'s unique constraint.
- **`settings` import in main.py**: `settings` from `config.py` is NOT imported by default — add `from config import settings` explicitly when adding `settings.*` references to `main.py`.
- **FastAPI HTTPBearer gotcha**: Default `HTTPBearer()` returns 403 when no token is present. Always instantiate with `HTTPBearer(auto_error=False)` and raise an explicit `401` when `credentials is None`.
- **AI retry logic** (`ai_utils.py`): Both `generate_smart_goal` and `generate_sprint_tasks` retry up to 3 times (1s/2s backoff) on `APIError`, `JSONDecodeError`, or `ValidationError` via `_with_retry()`. On final failure they raise `AIGenerationError` (from `exceptions.py`). `create_goal` (two-phase) returns 202; background task marks the placeholder milestone `failed` on AI error.
- **`google.genai.errors.APIError` in tests**: Cannot be instantiated with a plain dict — needs a mock response: `mock = MagicMock(); mock.body_segments = [{"error": {...}}]; raise APIError(503, mock)`.
- **Rate limiting** (`slowapi`): Global default 100 req/min per IP. Stricter per-user limits: `POST /users/{user_id}/goals` → 5/min; `POST /goals/{goal_id}/milestones/{milestone_id}/complete` → 10/min. Exceeded requests get 429 with `Retry-After: 60`. Disable entirely with `RATE_LIMIT_ENABLED=false` (tests, local dev). Rate-limited endpoints require `request: Request` as their first parameter. The `rate_limit()` helper in `main.py` is a no-op when disabled — no middleware or exception handler is registered.
- **Strict Boundaries**:
  - DO NOT refactor the Auth JWT logic unless explicitly instructed.
  - DO NOT tighten or modify the CORS `allow_origins` during local development tasks.
- **AppHeader nav**: New authenticated pages must be added to the `["dashboard", "analytics", "settings"]` array in `src/components/AppHeader.tsx` to appear in the nav.
- **`GET /users/{user_id}/goals` is paginated**: Returns `{ items, total, limit, offset }`. Frontend must read `.data.items`; Dashboard uses `?limit=20&offset=0`, Analytics uses `?limit=100&offset=0`.
- **Milestone-Gated Architecture**: Progress = `milestones_completed / milestones_total`. "Achieved"
  only available when all milestones are `is_completed`. AI chooses 3-5 milestones; sprints = 7 days fixed.
- **Row locking for milestone mutations**: Both `complete_milestone` and `retry_sprint_generation` use `.with_for_update()` on milestone SELECTs to prevent race conditions. Any new endpoint that mutates milestone status must follow this pattern.
- **Background tasks (pre-gen)**: `asyncio.create_task()` coroutines MUST open their own
  `AsyncSession(engine)` — they cannot reuse the closed request session.
- **Background task error logging**: Every `asyncio.create_task()` call must attach `_log_task_exception` as a done-callback — bare `create_task()` silently swallows unhandled exceptions.
- **asyncio done-callback order**: Register `_log_task_exception` BEFORE any cleanup/discard callback (e.g. `_background_tasks.discard`) so the task ref is still alive when logging fires.
- **Background task strong refs**: Store `asyncio.create_task()` results in a module-level `set[asyncio.Task]`; add on creation, discard in a done-callback after `_log_task_exception`. See `services/task_service.py`.
- **`zoneinfo` requires `tzdata`**: Add `tzdata>=2024.1` to `requirements.txt` whenever using `zoneinfo.ZoneInfo` — required on Windows and `python:*-slim` Docker images. Guard with `except (ZoneInfoNotFoundError, KeyError, TypeError)` to handle unknown keys and `None`.
- **Timezone-aware dates**: Use `user_today(user.timezone)` from `utils.py` instead of `date.today()` in any user-facing date calculation. Background tasks (e.g. `_pre_generate_sprint`) must load the user row themselves since they run outside the request session.
- **Frontend local date**: Use `new Intl.DateTimeFormat('en-CA').format(new Date())` for YYYY-MM-DD in browser local timezone. Use the `daysAgo(dateStr, n)` helper in `gamification.ts` for DST-safe date arithmetic — avoids `864e5/toISOString` which is UTC-anchored.
- **AI call timeout**: All Gemini calls go through `_with_retry` in `ai_utils.py`, which wraps each attempt with `asyncio.wait_for(..., timeout=_AI_TIMEOUT)` (30s). Follow this when adding new generation functions — do not call `generate_content` directly outside `_with_retry`.
- **Gemini**: Use `temperature=1.0` for Gemini 2.5 Flash (required for thinking mode). Pattern:
  `response_mime_type="application/json"` + `response_schema=PydanticModel`.
- **Alembic autogenerate needs live DB**: `--autogenerate` connects to the database via `DATABASE_URL`. If the DB is in Docker and not running, it fails. Write migrations manually (`op.drop_column`, `op.add_column`) when the DB is unreachable.
- **Alembic autogenerate limitations**: `CheckConstraint` is NOT detected by `--autogenerate`. After generating a migration with check constraints in models, manually add `op.create_check_constraint(...)` and `op.drop_constraint(...)` to the upgrade/downgrade functions. Use `if_not_exists=True` on `create_index` for idempotent migrations.
- **Alembic gotcha**: `Base.metadata.create_all` on startup auto-creates blank tables before
  migrations run, causing `DuplicateTableError`. If this happens: drop the auto-created table,
  then re-run `alembic upgrade head`.
- **Broken Alembic revision chain**: If a migration file is deleted after being applied, `alembic upgrade head` fails with `KeyError: '<rev>'`. Fix: create a stub `.py` file for the missing revision with the correct `down_revision` and empty `upgrade()`/`downgrade()` functions.
- **Catch-up migration pattern**: When a migration was applied to prod then the file deleted/replaced by a new revision ID, create a stub for the old revision and use `op.execute("ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...")` in the replacement so it's idempotent on prod and correct on fresh DBs.
- **Running tests**: `GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest apps/api/tests/ -v` — both vars required: `py -3` because `pytest` is not on PATH on Windows; `GEMINI_API_KEY` because `ai_utils.py` instantiates the Gemini client at import time before any test mocks apply. Inside Docker (Linux), use `python -m pytest` instead of `py -3 -m pytest`.
- **pytest Linux CI hang**: All tests pass in ~3s but the Python process hangs 10+ min on Linux CI. Root cause: `aiosqlite` runs SQLite in a background non-daemon thread; when the event loop closes, that thread keeps the process alive. Fix: `pytest_sessionfinish` hook in `conftest.py` calls `os._exit(int(exitstatus))` to bypass Python's finalizer machinery. Also present: `cancel_pending_tasks` autouse fixture cancels asyncio tasks after each test; `asyncio_default_fixture_loop_scope = function` in `pytest.ini` ensures per-test loop cleanup. All three are required — do not remove them.
- **Email mock tests**: Tests checking "no API key → log mock" must patch `services.email_service.settings` with `mock_settings.resend_api_key = ""` — never rely on env having no key (local `.env` may have `RESEND_API_KEY` set).
- **Test mock patch paths**: Tests patch `routes.goals.generate_smart_goal`, `routes.milestones.generate_sprint_tasks`, `routes.tasks.regenerate_single_task`, `services.task_service._pre_generate_sprint`, and `routes.jobs.send_reminder_digest` (NOT `main.*` or `services.*`). New test files must use these module paths.
- **Test auth override gotcha**: The `other_client` fixture shares `app.dependency_overrides` with `client` — using both in one test causes the second fixture to overwrite `get_current_user_id`. For 403-forbidden tests, temporarily swap the override within the test body: `app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID` in a `try/finally` block (see `test_goals.py` pattern).
- **Job endpoint auth pattern**: Background/cron endpoints use `X-Api-Key` header + `_verify_api_key` dependency (in `routes/jobs.py`) instead of Clerk JWT. Uses `secrets.compare_digest()` for timing-safe comparison. Always enforced — returns 401 if `JOBS_API_KEY` is empty (no dev bypass).
- **SQLite pool kwargs**: `pool_size`, `max_overflow`, `pool_timeout`, and `pool_pre_ping` are invalid for SQLite/StaticPool (used in tests). Conditionally apply them only when `settings.database_url` does not start with `"sqlite"`.
- **Worktree node_modules on Windows**: Worktrees don't inherit `node_modules`. Create a junction before running `npm run build` or `vite` from the worktree: `powershell -Command "New-Item -ItemType Junction -Path '.worktrees/<branch>/apps/web/node_modules' -Target 'apps/web/node_modules'"`.
- **Merging PRs**: The GitHub MCP merge tool returns 403. Use `gh pr checks <number>` to verify CI, then `gh pr merge <number> --squash --delete-branch` to merge. From the main working directory (`D:\PyCharm\goalforge`), run `git pull` to sync. Note: `git checkout main` fails if run from inside a worktree — always pull from the main dir.
- **Reading CI job logs**: `gh run view --job=<job-id> --repo Samat-ai/goalforge --log 2>&1 | tail -60` — shows per-step stdout/stderr. Get `job-id` from `gh run view <run-id>`. Essential for diagnosing failures not visible in the run-level summary (e.g. tests passing but process hanging).
- **Structured logging**: `python-json-logger` outputs JSON in production (`ENVIRONMENT=production`), human-readable format otherwise. Every request gets a UUID injected via `request_id_var` (ContextVar) and logged with method, path, status, duration. `X-Request-ID` header is added to all responses.
- **Hooks active** (`.claude/settings.json`): `tsc --noEmit` runs automatically after any edit to `apps/web/src/**`; edits to `.env` files are blocked at the PreToolUse level.
- **Resend SDK is sync-only**: `resend.Emails.send()` uses `requests` internally. Always wrap with `asyncio.to_thread()` to avoid blocking the event loop. API key is set once at module level in `email_service.py`.
- **pip install quoting**: Always use `py -3 -m pip install "pkg>=ver"` (quoted) — unquoted `>=` is interpreted as shell redirect and creates junk files.
- **WSL relay port conflict**: On Windows/WSL2, `wslrelay.exe` can bind `[::1]:5173` (IPv6), intercepting `localhost` before Docker. Diagnose with `netstat -ano | findstr ":5173.*LISTENING"`. Fix: `powershell -Command "Stop-Process -Id <PID> -Force"`. May recur after reboot.
- **`/db-migrate "<message>"`**: skill that runs `alembic revision --autogenerate` + `upgrade head` in one shot.
- **`/gen-test`**: skill that generates a pytest-asyncio test file for a new FastAPI endpoint following GoalForge test patterns.
- **Rescue loop (GoalCard)**: When `goal.rescue_mode && !isGenerating`, GoalCard shows a rescue card instead of SprintRail/DailyTaskList. Dismiss stores `rescue_dismissed_<goal_id>` timestamp in localStorage; dismissed state clears after 8h. `triggerRescue(goalId)` fires `POST /goals/{goal_id}/rescue` (fire-and-forget), then invalidates goals query to pick up new rescue tasks.
- **Adaptive Energy Check-in flow**: `?energy=low` on any URL is captured by `EnergyParamCapture` (inside `<BrowserRouter>`, before `<Routes>`) into `sessionStorage` before Clerk strips it on redirect. Dashboard reads `sessionStorage.getItem('energy')` via lazy `useState` initializer on mount, clears it, and opens `EnergyModal`. Modal calls `POST /users/{user_id}/energy-resize` (mutate-with-undo: saves `original_description`/`original_tip`, writes micro-tasks). Per-task `↩` restore button in `DailyTaskList` calls `POST /tasks/{task_id}/restore`. TodayBar also shows 🌙 Low energy button organically. `useTaskRestoreMutation` lives in `GoalCard` (smart parent) — not Dashboard.
- **Energy resize — assigned_date safety**: `resize_task_for_low_energy()` in `ai_utils.py` returns `AITaskOutput` which has an `assigned_date` field. Callers MUST discard `result.assigned_date` — only `result.description` and `result.tip` are written back to the DB. This prevents AI from accidentally moving tasks to wrong dates.
- **Energy resize — parallel Gemini calls**: `asyncio.Semaphore(5)` limits concurrent AI calls in `routes/energy.py`. `asyncio.gather(..., return_exceptions=True)` isolates partial failures — tasks where Gemini fails are silently skipped (warning logged); only successful results are written.

## Preferred Coding Patterns

- **dnd-kit `useSortable` context requirement**: The `disabled` prop suppresses drag interaction but does NOT remove the hook's dependency on `DndContext` + `SortableContext` ancestors. Any component that calls `useSortable` (even with `disabled: true`) must be rendered inside both providers — wrap non-draggable lists in a bare `<DndContext><SortableContext items={...}>` to avoid runtime crashes.
- **TypeScript closure narrowing**: Control-flow narrowing (null checks, discriminated union guards) from the outer render body does NOT flow into nested function bodies (closures). Always add an explicit guard inside the closure: `if (!x) return` — even if the outer component already has `if (!x) return null`.
- **Removing auth bypasses**: When eliminating a dev-bypass (e.g., `if not key: skip auth`), grep for tests that relied on the bypass and update them in the same commit.
- **ESLint unused params in Query callbacks**: Prefixed-unused params like `_taskId`, `_context` in `onSuccess(data, _taskId, _context)` still fail `no-unused-vars`. Drop trailing unused params entirely: `onSuccess: (data) => {`.
- **ESLint impure render (very strict)**: `Date.now()` / `new Date()` are banned everywhere in the render body — even inside `useMemo`, `useRef(init)`, or as a hoisted `const`. Only safe in `useEffect` callbacks and event handlers. For render-time use: compute in `useEffect`, store in state or ref, and read from there.
- **ESLint `react-hooks/set-state-in-effect`**: Calling `setState` synchronously inside `useEffect` is an error. Three workarounds: (1) lazy `useState` initializer `useState(() => { /* read external source once */ })` — best for one-time sessionStorage/localStorage reads; (2) extract a sub-component that receives loaded data as props and initializes `useState` from props (e.g., `SettingsForm` pattern); (3) pure computation from existing render-scope values — avoids `useState` + `useEffect` altogether.
- **ESLint `react-hooks/refs`**: Cannot read `ref.current` during render/JSX. Refs are only accessible in effects and event handlers.
- **JSX string apostrophe**: Never use a single-quoted JS string containing an apostrophe in JSX (e.g. `'today's tasks'` — the apostrophe closes the string). Use double quotes: `"today's tasks"`.
- **useEffect + optional chaining**: When `user?.id` is in the dep array, extract `const userId = user?.id` at the top of the effect body and use `userId` inside — avoids `react-hooks/exhaustive-deps` warnings from `user!.id` non-null assertions.
- **FastAPI / SQLAlchemy**: Strictly use asynchronous patterns (`async def`, `AsyncSession`).
- **Queries**: Always prefer SQLAlchemy 2.0 `select()` statements over legacy `.query()`.
- **Execution**: Never use `Session.execute` without an `await`.
- **Atomic Operations**: Always use SQL-level math (e.g., `User.star_points + 10`) for point transactions to prevent race conditions. Do not compute points in memory and save.

## Git conventions

- **Always branch, never commit to main** — create a `feature/` or `fix/` branch before any work; open a PR; merge via `gh pr merge <number> --squash --delete-branch` after CI passes.
- Branch naming: `feature/<short-description>`, `fix/<short-description>`, `refactor/<short-description>`
- Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- GitHub Actions: automated Claude code review and PR assistant (`.github/workflows/`)
- Never stage `apps/api/__pycache__/` files — they always appear modified but are compiled bytecode artifacts.
- **Windows bash paths**: Use `/d/PyCharm/goalforge/...` (Unix-style) for Bash `cd` commands — `D:\...` paths fail. Glob/Grep/Read tools accept Windows paths fine.

## Product & UI Philosophy

- **Aesthetic**: "Obsidian Command" — dark mode, `'JetBrains Mono', monospace` for badges/stats/sprint numbers, `'Plus Jakarta Sans', sans-serif` for headings/body. Use full-screen width; avoid restrictive containers that squish the dashboard.
- **Design token pattern**: All fonts and colors are centralized in `src/lib/theme.ts` and exported as `const T`. All pages and components import it: `import { T } from '../lib/theme'`. Update tokens in `theme.ts` only — do not redefine `T` locally in components.
- **New page conventions**: New pages should use `min-h-dvh` (not `min-h-screen`) for correct mobile viewport height, and apply `className="mesh-bg"` (defined in `index.css`) for the ambient radial gradient background.
- **Tailwind v4**: No `tailwind.config.js` exists. Theme overrides go in a `@theme {}` block in `src/index.css`. Use `py -3` (not `python3`) on this Windows machine to run Python scripts.
- **Touch targets**: All interactive elements (buttons, icon actions) must have `minHeight: 44, minWidth: 44` for mobile usability.
- **Responsive pattern**: Components use inline `style={}` for design tokens (color, font). Add responsive breakpoints via Tailwind `className` while keeping colors/fonts in `style`. Don't use inline `style` for padding/layout where responsive variants are needed.
- **CSS animations**: Define `@keyframes` + utility class in `src/index.css` (e.g., `.goal-achieved`, `.animate-slide-up`), apply via `className` in components. Don't use inline keyframes.
- **Anti-Cheat Mechanics**: Gamification must feel earned. Do not implement manual progress sliders. Star brightness should scale gradually based on consecutive daily task completions, not jump to 100% instantly.
- **Focus mode anti-exploit (`pickOneThing`)**: Future tasks (`assigned_date > today`) are explicitly excluded — returning them lets users pre-complete an entire 7-day sprint on day 1, farming points and advancing milestones without the daily habit mechanic. Do not add future tasks back.
- **Goal Status**: Strictly adhere to the "3 A's": `ACTIVE`, `ACHIEVED`, and `ABANDONED`.
