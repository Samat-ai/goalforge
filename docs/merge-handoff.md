# GoalForge — Merge Handoff Brief

**Purpose**: Ops log for a Claude Code session that will merge all 57 feature PRs into
`main` in the correct order. Read this before touching any PR.

**Companion doc**: `docs/pr-merge-guide.md` — full conflict resolution details, migration
chain, and file-level strategies. This document is the *fast-path checklist*; the merge
guide is the reference.

---

## What Was Already Built (and Pre-Fixed)

57 feature branches were cut from the same `main` commit by a prior Claude Code session.
Six branches had bugs that were **already patched on the branch** before any merging
begins. Do not re-apply these fixes — they are already committed.

| PR | Branch | Bug fixed on branch |
|----|--------|---------------------|
| #162 | `feature/slow-query-log` | `register_slow_query_listener(engine)` call added to `database.py` (agent forgot it) |
| #163 | `feature/ci-migration-check` | CI steps committed (agent hit rate limit before committing) |
| #149 | `feature/startup-validation` | Added `stripe_secret_key: str = ""` and `sentry_dsn: str = ""` to `config.py` — `startup.py` checks these via `getattr` but they weren't in Settings (extra="ignore" silently dropped them) |
| #131 | `feature/goal-notes` | Migration revision changed from `a1b2c3d4e5f7` → `c2d3e4f5a6b7` (collision with #141) |
| #118 | `feature/celery-redis-queue` | All Celery module paths changed from `apps.api.tasks.*` → `tasks.*` (container WORKDIR is `/app` = `apps/api`, not repo root) |
| #157 | `feature/db-indexes` | All `CREATE INDEX CONCURRENTLY` wrapped in `op.get_context().autocommit_block()` — Postgres forbids CONCURRENTLY inside a transaction |

---

## Migration Chain

All migrations branch from the same main tip. Merge in this exact order and update
`down_revision` before each merge. Never let `alembic heads` show more than one line.

```
main tip:  b7c8d9e0f1a2
  └─ #107  e3f4a5b6c7d8  (stripe-subscription)   ← needs new ID, see §Migration IDs
      └─ #139  f6a7b8c9d0e1  (goal-archiving)      ← update down_revision to e3f4a5b6c7d8
          └─ #141  a1b2c3d4e5f7  (notification-preferences) ← update to f6a7b8c9d0e1
              └─ #131  c2d3e4f5a6b7  (goal-notes)  ← update to a1b2c3d4e5f7
                  └─ #157  a4b5c6d7e8f9  (db-indexes) ← no update needed (additive indexes)
```

### Migration IDs — Required Edits at Merge Time

**#107 stripe-subscription** (`add_subscriptions_table.py`):
- Current revision: `e3f4a5b6c7d8` — **collides with nothing** (already unique), but the
  file is named `add_subscriptions_table.py`; rename to `e3f4a5b6c7d8_add_subscriptions_table.py`
- `down_revision` is already `b7c8d9e0f1a2` ✓

**#139 goal-archiving** (`add_goal_archived_at.py`):
- Change `down_revision = "b7c8d9e0f1a2"` → `down_revision = "e3f4a5b6c7d8"`

**#141 notification-preferences** (`add_notification_prefs.py`):
- Change `down_revision = "b7c8d9e0f1a2"` → `down_revision = "f6a7b8c9d0e1"`

**#131 goal-notes** (`add_goal_notes_table.py`):
- Revision is already `c2d3e4f5a6b7` (pre-fixed) ✓
- Change `down_revision = "b7c8d9e0f1a2"` → `down_revision = "a1b2c3d4e5f7"`

**#157 db-indexes** (`add_missing_indexes.py`):
- `down_revision = "b7c8d9e0f1a2"` is fine — indexes are additive, not chained to the
  field migrations. Point at the latest tip after all field migrations land:
  change to `down_revision = "c2d3e4f5a6b7"`

---

## Merge Order — Tier by Tier

Work through each tier completely before starting the next. Within a tier the exact order
is flexible unless a dependency is noted.

### Tier 1 — Foundation (merge first, no dependencies)

These only add middleware, config fields, or stand-alone modules. No migration. No
cross-PR conflicts within this tier.

| PR | Branch | What it does | Manual step at merge |
|----|--------|--------------|----------------------|
| #126 | `feature/ci-improvements` | Full CI rewrite — separate lint/test jobs, Python 3.13, Node 22, coverage | none |
| #163 | `feature/ci-migration-check` | Adds `alembic check` + single-head guard to backend-test job | **Conflict with #126**: discard the standalone `backend-test` job this PR adds; instead manually insert its two migration-check steps into #126's `backend-test` job after `alembic upgrade head` (see merge guide §3 ci.yml) |
| #117 | `feature/fix-exception-handlers` | Replaces bare `except Exception` with `SQLAlchemyError`, adds typed exception classes | none |
| #120 | `feature/centralize-timezone` | Rewrites `utils.py` with full timezone API (`get_user_tz`, `user_now`, `user_today`, `user_start_of_day`, `utc_now`, `to_user_tz`, `days_since`) | none — but **note**: `feature/pagination` (#138, Tier 5) adds `encode_cursor`/`decode_cursor` to `utils.py`; those will need to be re-appended when #138 merges |
| #121 | `feature/collectible-registry-config` | Moves collectible definitions to `collectibles.py` with `BY_KEY`, `BY_TIER`, `get_eligible_collectibles` | none |
| #122 | `feature/sentry-integration` | Sentry SDK init in API + web; adds `sentry_dsn` to `config.py` | **Conflict with #149**: `startup-validation` added `sentry_dsn: str = ""` as a workaround — keep the richer Sentry version, delete the stub field |
| #125 | `feature/openapi-typescript` | Adds `openapi-ts.config.ts`, `api-types.generated.ts`, `api-client.ts` for type-safe API calls | none |
| #149 | `feature/startup-validation` | `startup.py` validates required config at boot; pre-fixed to include `stripe_secret_key` + `sentry_dsn` in Settings | **Conflict with #107 and #122**: after those merge, the workaround fields (`stripe_secret_key`, `sentry_dsn`) become duplicates — keep the richer versions from #107/#122 |
| #151 | `feature/request-logging` | `RequestLoggingMiddleware` — logs method/path/status/ms + `X-Request-ID` header; skips `/health` | none |
| #156 | `feature/security-headers` | `SecurityHeadersMiddleware` — HSTS, X-Frame-Options, X-Content-Type-Options, CSP | none |
| #154 | `feature/response-compression` | GZip middleware + ETag/304 support on `GET /users/{id}/goals` | none |
| #155 | `feature/query-optimization` | `selectinload(DailyTask.milestone)` on task load to eliminate N+1 in `regenerate_task` | none |
| #150 | `feature/typescript-strict` | Adds `strict`, `noUnusedLocals`, `noImplicitReturns`, `noFallthroughCasesInSwitch` to `tsconfig.app.json` | none |
| #162 | `feature/slow-query-log` | `db_listeners.py` logs queries >200ms via SQLAlchemy cursor events | none |

### Tier 2 — Infrastructure

Middleware/services that touch `main.py`, `config.py`, or `requirements.txt`. Merge after
Tier 1 so CI is green.

| PR | Branch | What it does | Manual step at merge |
|----|--------|--------------|----------------------|
| #118 | `feature/celery-redis-queue` | Celery worker + beat, Redis broker, `celery_app.py`, `tasks/goal_tasks.py`, `tasks/notification_tasks.py` — pre-fixed: all paths use `tasks.*` not `apps.api.tasks.*` | **Conflict with `docker-compose.yml`**: discard this PR's `docker-compose.yml` — #145 has the complete version (see merge guide §3 docker-compose.yml) |
| #123 | `feature/redis-rate-limiting` | `SlowAPI` rate limiting, `rate_limit` decorator, `RATE_LIMIT_ENABLED` config flag | **Note**: adds `redis==5.2.0` to requirements.txt — #118 also adds this; deduplicate |
| #124 | `feature/service-worker-caching` | `sw.js` caching strategy — cache-first for assets, network-first for API | **Conflict with #115 (mobile-pwa)**: this PR's `sw.js` wins; when #115 merges, cherry-pick only its PWA-specific additions (install prompt, manifest icons), do not revert caching strategy |
| #127 | `feature/html-email-templates` | Jinja2 `email_renderer.py` + four `.html.j2` templates; adds `jinja2==3.1.4` to requirements | none |
| #108 | `feature/feature-gating` | `subscription_service.py` with real `get_user_plan` + `require_pro` + `check_goal_limit` | **Merge before #136 (data-export)**: data-export has a stub `subscription_service.py` — discard the stub when #136 merges |
| #145 | `feature/docker-compose` | Complete Docker Compose rewrite — dev Dockerfiles, healthchecks, celery worker/beat, web hot-reload | none (this is the authoritative compose file) |
| #144 | `feature/react-query-errors` | `ApiError` class, `parseApiError`, axios interceptor, global React Query `onError` toast (skips 402) | none |

### Tier 3 — Data Model (migration PRs, strict order)

Run `alembic heads` after each merge — must always show exactly one line.

| PR | Branch | What it does | Required edit at merge |
|----|--------|--------------|------------------------|
| #107 | `feature/stripe-subscription` | `subscriptions` table + Stripe billing routes + `billing.py` router | Update `down_revision` → `b7c8d9e0f1a2` (already correct); rename migration file to include revision prefix |
| #128 | `feature/analytics-enhanced` | 6 new analytics endpoints + frontend charts | no migration; merge after #107 |
| #135 | `feature/health-check` | `/health`, `/health/ready`, `/health/info` routes | no migration; merge after #128 |

### Tier 4 — UI Features (no migrations)

No strict order within tier unless noted. All touch frontend files.

**Critical**: `Dashboard.tsx` is modified by 10 PRs — merge in the sub-order below.
`App.tsx` is modified by 5 PRs — merge `feature/code-splitting` (#146) last.

Sub-order for `Dashboard.tsx`:

| PR | Branch | What it adds to Dashboard | Manual step |
|----|--------|--------------------------|-------------|
| #114 | `feature/dark-light-mode` | `ThemeProvider` context, dark/light CSS vars, `ThemeToggle` in AppHeader | Wrap app in `<ThemeProvider>` in `App.tsx` |
| #109 | `feature/onboarding-flow` | `useSearchParams` to pre-fill goal from URL; `<OnboardingGuard>` in `App.tsx` | Add `<OnboardingGuard>` route wrapper |
| #111 | `feature/upgrade-prompts` | `GoalLimitBanner`, `UpgradePrompt` modal trigger | none |
| #140 | `feature/goal-search` | Search input in filter bar | none |
| #139 | `feature/goal-archiving` | Archived-goals tab + `include_archived` query param on API | **Migration required** — update `down_revision` (see §Migration IDs) |
| #113 | `feature/progress-sharing` | Share button + `<ShareModal>` | none |
| #137 | `feature/keyboard-shortcuts` | `<KeyboardShortcutsModal>`, `onOpenShortcuts` prop on AppHeader | none |
| #143 | `feature/skeleton-loading` | `<GoalCardSkeleton>` replaces spinner | none |
| #161 | `feature/query-error-boundaries` | `<QueryErrorBoundary>` wraps goal list | none |
| #148 | `feature/accessibility` | ARIA landmarks, roles, aria-live regions | none |

Other Tier 4 PRs (independent of Dashboard order):

| PR | Branch | What it does | Manual step |
|----|--------|--------------|-------------|
| #110 | `feature/landing-page-overhaul` | Full marketing page rewrite | none |
| #115 | `feature/mobile-pwa` | PWA manifest, install prompt | See #124 sw.js note |
| #112 | `feature/goal-templates` | `GoalTemplates.tsx` browse-and-select UI in `AddGoal.tsx` | none |
| #130 | `feature/error-pages` | `NotFoundPage`, `OfflinePage`, `ErrorPage`; `<Route path="*">` in App | none |
| #136 | `feature/data-export` | `GET /users/{id}/export` JSON+CSV (Pro only) | Discard stub `subscription_service.py` — keep #108's version |
| #142 | `feature/error-response-format` | `error_responses.py` helpers + global `http_exception_handler` in `main.py` | none |
| #116 | `feature/e2e-auth-guard-and-goal-type` | `GoalType` Literal in schemas, E2E console guard, `e2e-mode-guard` Vite plugin | **Conflict with #146 (vite.config.ts)**: both modify `vite.config.ts` — combine: plugins from this PR + build.rollupOptions from #146 |
| #152 | `feature/form-validation` | Inline validation in `AddGoal.tsx` and `Settings.tsx` | none |
| #153 | `feature/optimistic-updates` | Full optimistic mutations with rollback in `useGoalMutations.ts` | none |
| #119 | `feature/split-components` | `GoalCard` → `GoalCardHeader/Milestones/Actions`; `DailyTaskList` → `TaskItem/Controls/EmptyState` | **Must merge after #148 (accessibility)** — ARIA attrs added by #148 must be moved into the correct sub-components after split |
| **#146** | `feature/code-splitting` | All page imports → `React.lazy`, `<Suspense>`, Vite `manualChunks` | **Merge last in Tier 4** — converts all static imports; add lazy import for `NotFoundPage`/`OfflinePage` from #130 too |

### Tier 4b — Performance Index Migration

| PR | Branch | What it does | Required edit |
|----|--------|--------------|---------------|
| #157 | `feature/db-indexes` | Adds indexes on `goals.status`, `coach_sessions.forged_goal_id`, `milestones.sprint_status` using `CONCURRENTLY` + `autocommit_block()` — pre-fixed | Update `down_revision` → `c2d3e4f5a6b7` (tip after all field migrations) |

### Tier 5 — New Model Fields (migration PRs, strict order)

| PR | Branch | What it does | Required edit |
|----|--------|--------------|---------------|
| #141 | `feature/notification-preferences` | `notification_preferences` table; user pref settings UI | Update `down_revision` → `f6a7b8c9d0e1` |
| #138 | `feature/pagination` | Cursor-based pagination on goals + tasks; `encode_cursor`/`decode_cursor` in `utils.py` | **Re-append cursor helpers to `utils.py`** after #120 (centralize-timezone) overwrote them in Tier 1 |
| #131 | `feature/goal-notes` | `goal_notes` table; CRUD routes `/goals/{id}/notes`, `/notes/{id}` | Update `down_revision` → `a1b2c3d4e5f7`; revision already fixed to `c2d3e4f5a6b7` |

### Tier 6 — Tests

Merge after the feature PRs they cover are on `main`.

| PR | Branch | Covers | Note |
|----|--------|--------|------|
| #159 | `feature/test-factories` | Adds `make_goal`, `make_milestone`, `make_task` fixtures to `conftest.py` | Merge first in this tier — other test PRs may use these fixtures |
| #129 | `feature/tests-billing-and-gating` | Stripe billing, plan enforcement, subscription service | needs #107 + #108 on main |
| #132 | `feature/tests-analytics` | Analytics endpoints + streak/trend logic | needs #128 on main |
| #134 | `feature/tests-goal-notes` | Goal notes CRUD | needs #131 on main |

### Tier 7 — Dev Tooling (safe to merge any time)

| PR | Branch | What it does |
|----|--------|--------------|
| #133 | `feature/seed-data` | `seed.py` dev data script; production guard (`settings.environment == "production"` blocks it) |
| #158 | `feature/github-templates` | `.github/ISSUE_TEMPLATE/` + `pull_request_template.md` |
| #160 | `feature/makefile` | `Makefile` with `dev`, `test`, `migrate`, `seed`, `lint` targets |
| #147 | `feature/pr-merge-guide` | `docs/pr-merge-guide.md` + this file — merge last |

---

## Most Contested Files — Quick Reference

| File | Branches | Strategy |
|------|----------|----------|
| `apps/api/main.py` | 12 branches | All changes additive (routers + middleware). Keep everything. |
| `apps/web/src/pages/Dashboard.tsx` | 10 branches | Follow sub-order in Tier 4 above |
| `apps/api/schemas.py` | 9 branches | All additive (new interfaces, new optional fields). Keep all. |
| `apps/web/src/lib/types.ts` | 7 branches | All additive. Keep more permissive type when two branches define same field. |
| `apps/api/routes/goals.py` | 7 branches | #108 (gates), #138 (cursor + include_archived), #140 (search param), #139 (archive routes) — all additive |
| `apps/api/requirements.txt` | 6 branches | All additive. Deduplicate `redis==5.2.0` (added by both #118 and #123). |
| `apps/web/src/components/GoalCard.tsx` | 5 branches | Merge #148 (accessibility) before #119 (split); re-apply ARIA attrs into sub-components after split |
| `apps/web/src/components/AppHeader.tsx` | 5 branches | All additive (ThemeToggle, PlanBadge, shortcuts button, billing nav link, ARIA nav wrapper) |
| `apps/web/src/App.tsx` | 5 branches | Merge #146 (code-splitting) last; it converts all imports to lazy |
| `apps/api/config.py` | 5 branches | Additive. Deduplicate `stripe_secret_key` (#149 stub → keep #107 version) and `sentry_dsn` (#149 stub → keep #122 version) |
| `apps/web/vite.config.ts` | 3 branches | #116 adds plugin, #146 adds build.rollupOptions — combine both |
| `apps/web/public/sw.js` | 2 branches | #124 wins; #115 cherry-picks only PWA additions |
| `docker-compose.yml` | 2 branches | #145 wins; discard #118's version |
| `apps/api/services/subscription_service.py` | 2 branches | #108 wins; discard #136's stub |
| `apps/api/utils.py` | 2 branches | #120 rewrites (Tier 1). Re-append `encode_cursor`/`decode_cursor` when #138 merges (Tier 5) |
| `.github/workflows/ci.yml` | 2 branches | #126 wins; cherry-pick only the two migration-check steps from #163 |

---

## Key Technical Facts

- **Python**: 3.13, FastAPI, SQLAlchemy 2.0 async, Alembic 1.14.0
- **Frontend**: React 19, TypeScript, Tailwind CSS 4, React Query 5, Clerk auth
- **Container WORKDIR**: `/app` maps to `apps/api` — Celery task paths must use `tasks.*` not `apps.api.tasks.*`
- **Auth**: Clerk JWT — `get_current_user_id()` dependency in all protected routes
- **DB**: PostgreSQL 16 in prod/CI; SQLite (aiosqlite) in tests — migrations must not use PG-specific types in column definitions (use `String` not `VARCHAR(n)` etc.)
- **Alembic `autocommit_block()`**: available since 1.14.0 — required for `CREATE INDEX CONCURRENTLY`
- **Test pattern**: `@pytest.mark.xfail(strict=False)` for tests covering unmerged features — CI stays green
- **Rate limit**: `RATE_LIMIT_ENABLED=false` in dev/test; enabled in prod via `config.py`
- **E2E mode**: `VITE_E2E_MODE=true` bypasses Clerk auth — must never be set in production builds (guarded by `e2e-mode-guard` Vite plugin from #116)

---

## Verification Commands

```bash
# After every migration PR merge — must show exactly 1 line
cd apps/api && alembic heads

# After Tier 1 — run full test suite
cd apps/api && pytest tests/ -x -q

# After Tier 4 — TypeScript check
cd apps/web && npx tsc --noEmit

# Check which files a branch changes (useful during conflict resolution)
git diff main..feature/<branch-name> --name-only

# Generate a fresh Alembic revision ID if you ever need one
python3 -c "import uuid; print(uuid.uuid4().hex[:12])"
```
