# GoalForge Feature PR Merge Guide

55 feature branches were cut from the same `main` commit. This guide explains the safest
order to merge them and how to resolve the conflicts that will arise in Alembic migrations
and in shared source files.

---

## 1. Merge Order (Priority Groups)

Work through each tier completely before starting the next. Within a tier the PRs are
independent of each other, so the exact order inside a tier is flexible unless noted.

### Tier 1 — Foundation (no dependencies, merge first)

These PRs touch only CI config, error handling plumbing, or stand-alone modules. They are
safe to merge in any order and establish a stable base.

| PR | Branch | Description |
|----|--------|-------------|
| #126 | `feature/ci-improvements` | GitHub Actions CI/CD pipeline improvements |
| #117 | `feature/fix-exception-handlers` | Replace bare `except Exception` with specific types |
| #120 | `feature/centralize-timezone` | Centralize timezone utilities in `utils.py` |
| #121 | `feature/collectible-registry-config` | Extract collectible registry to dedicated module |
| #122 | `feature/sentry-integration` | Sentry error tracking (API + web) |
| #125 | `feature/openapi-typescript` | OpenAPI TypeScript type generation |
| — | `feature/startup-validation` | Startup config validation checks (adds `stripe_secret_key`, `sentry_dsn` to Settings) |
| — | `feature/request-logging` | HTTP request/response logging middleware |
| — | `feature/security-headers` | HTTP security headers middleware (HSTS, CSP, etc.) |
| — | `feature/response-compression` | GZip response compression middleware |
| — | `feature/error-response-format` | Standardized API error shape `{"error": {"code", "message", "status"}}` |
| — | `feature/slow-query-log` | SQLAlchemy slow-query logging (>200ms) via `before/after_cursor_execute` |
| — | `feature/typescript-strict` | TypeScript strict mode + `noUnusedLocals`, `noImplicitReturns` |
| — | `feature/query-optimization` | N+1 query fixes in `tasks.py` (adds missing `selectinload`) |

### Tier 2 — Infrastructure

Infrastructure layers that may touch `main.py`, `config.py`, or `requirements.txt`. Merge
after Tier 1 to avoid fighting CI failures.

| PR | Branch | Description |
|----|--------|-------------|
| #118 | `feature/celery-redis-queue` | Celery + Redis async job queue |
| #123 | `feature/redis-rate-limiting` | Redis-backed rate limiting middleware |
| #124 | `feature/service-worker-caching` | Service worker offline caching strategy |
| #127 | `feature/html-email-templates` | Jinja2 HTML email templates |
| #108 | `feature/feature-gating` | Free/Pro feature gating (`subscription_service`) |
| — | `feature/docker-compose` | Comprehensive Docker Compose rewrite with dev Dockerfiles, healthchecks, celery workers |
| — | `feature/react-query-errors` | React Query global error handling + `ApiError` class |

### Tier 3 — Data Model Changes (migrations)

These PRs create new tables or add columns. They **must** be merged in the order listed
because each migration's `down_revision` must be updated to point to the previous one
after it lands on `main`. See Section 2 for the exact edits required.

| PR | Branch | Migration file | New revision ID |
|----|--------|---------------|-----------------|
| #107 | `feature/stripe-subscription` | `add_subscriptions_table.py` | needs new ID (collision — see §2) |
| #128 | `feature/analytics-enhanced` | *(no migration — analytics-only route/schema changes)* | — |
| #135 | `feature/health-check` | *(no migration — adds `/health` route only)* | — |

Merge order: #107 → #128 → #135.

### Tier 4 — UI Features (no model changes)

No Alembic migrations. Some PRs touch shared frontend files (`App.tsx`,
`Dashboard.tsx`) — see Section 3 for conflict strategy.

| PR | Branch | Description |
|----|--------|-------------|
| #110 | `feature/landing-page-overhaul` | Full marketing landing page rewrite |
| #109 | `feature/onboarding-flow` | Multi-step onboarding wizard |
| #114 | `feature/dark-light-mode` | Dark/light theme toggle |
| #115 | `feature/mobile-pwa` | Mobile PWA manifest + install prompt |
| #111 | `feature/upgrade-prompts` | Paywall/upgrade prompt components |
| #112 | `feature/goal-templates` | Goal templates library |
| #113 | `feature/progress-sharing` | Shareable progress cards |
| #130 | `feature/error-pages` | Custom 404 / offline / error pages |
| #137 | `feature/keyboard-shortcuts` | Keyboard shortcuts modal |
| — | `feature/accessibility` | ARIA labels, focus trap, keyboard navigation |
| — | `feature/code-splitting` | Route-level `React.lazy` + `Suspense` + Vite chunk splitting |
| — | `feature/e2e-auth-guard-and-goal-type` | E2E auth bypass guard + `goal_type` field docs |
| — | `feature/form-validation` | Frontend form validation in `AddGoal.tsx` and `Settings.tsx` |
| — | `feature/optimistic-updates` | Optimistic UI mutations with rollback in `useGoalMutations.ts` |
| — | `feature/query-error-boundaries` | `QueryErrorBoundary` wrapping Dashboard and Analytics |
| — | `feature/skeleton-loading` | Skeleton loading states for Dashboard and Analytics |
| — | `feature/split-components` | Extract `GoalCard` and `DailyTaskList` into sub-components |
| — | `feature/data-export` | Pro-gated JSON/CSV export (`/users/{id}/export`) — **requires #108** feature-gating merged first |

### Tier 4b — Performance (index migration, no schema changes)

These PRs add indexes only — no new tables or columns. They can be merged any time
after Tier 3 since they don't change the data model. The migration uses
`CREATE INDEX CONCURRENTLY` wrapped in `autocommit_block()`, so it is safe to run
against a live database.

| PR | Branch | Migration file | Notes |
|----|--------|---------------|-------|
| #157 | `feature/db-indexes` | `add_missing_indexes.py` | revision `a4b5c6d7e8f9`; no `down_revision` update needed (indexes are additive) |

### Tier 5 — New Model Fields (migrations)

These PRs each add columns. Must be merged in the order listed; update `down_revision`
after each one lands. See Section 2.

| PR | Branch | Migration file | Notes |
|----|--------|---------------|-------|
| #139 | `feature/goal-archiving` | `add_goal_archived_at.py` | needs new revision ID (collision — see §2) |
| #141 | `feature/notification-preferences` | `add_notification_prefs.py` | `down_revision` must be updated after #139 lands |
| #138 | `feature/pagination` | *(no migration — query-param + schema changes only)* | — |
| #140 | `feature/goal-search` | *(no migration — adds search query to existing route)* | — |
| #131 | `feature/goal-notes` | `add_goal_notes_table.py` | collision fixed — new ID `c2d3e4f5a6b7` (see §2) |

### Tier 6 — Tests

Test files only. They import production code, so merge after all feature PRs they cover
are already on `main`.

| PR | Branch | Covers |
|----|--------|--------|
| — | `feature/test-factories` | Shared test fixtures + factory helpers (`conftest.py`) — merge first in this tier |
| #132 | `feature/tests-analytics` | Analytics endpoint tests |
| #134 | `feature/tests-goal-notes` | Goal notes CRUD tests |
| — | `feature/tests-billing-and-gating` | Billing + feature gating tests |

### Tier 7 — Dev Tooling

Safe to merge any time after `main` is stable, but easiest last so the seed script picks
up all the new columns.

| PR | Branch | Description |
|----|--------|-------------|
| #133 | `feature/seed-data` | Development seed data script |
| — | `feature/makefile` | Makefile with dev shortcuts (`make dev`, `make test`, etc.) |
| — | `feature/github-templates` | GitHub issue and pull request templates |
| — | `feature/ci-migration-check` | Adds `alembic check` + single-head validation to CI (see ci.yml conflict in §3) |
| — | `feature/pr-merge-guide` | This document |

---

## 2. Migration Conflict Resolution

### The Problem

All migration PRs branched from the same `main` commit, so each new migration file has its
`down_revision` pointing to the **same tip revision** that existed at branch time. When you
merge them sequentially the chain forks and `alembic heads` will report multiple heads.
You must re-point each incoming migration to the revision that is now the real tip before
you commit the merge.

The current tip of the migration chain on `main` is:

```
b7c8d9e0f1a2  — b7c8d9e0f1a2_add_weekly_star_log_to_notification_log_type_constraint.py
```

### Full revision chain on `main` (before any feature merges)

```
 1  daf533cac4d3  initial_schema
 2  a2f4e6c8b1d3  add_progress_to_goals
 3  b3e1f9a2d8c5  add_milestones_table
 4  c4d2e8b3f1a6  backfill_milestones_from_json
 5  d5e3f9c4b2a7  drop_legacy_milestones_json
 6  2f0f06807e03  add_user_settings
 7  e6cdc1208a9f  add_check_constraints_and_indexes
 8  b791b5f8c525  stub
 9  54c2246897ae  drop_zombie_columns
10  c3a7d2e1f9b4  add_task_position_column
11  f7a8b9c1d2e3  add_generation_started_at
12  a1b2c3d4e5f6  stub_rescue_task_first_attempt      ← collision with goal-archiving PR
13  749ac4eda4cf  add_is_rescue_task_to_daily_tasks
14  ab3ab8b88a85  add_rewards_table
15  b2c3d4e5f6a1  add_energy_resize_columns
16  c9d4e7f1a2b6  add_user_reminder_preferences
17  b1c2d3e4f5a6  add_web_push_subscriptions
18  f1e2d3c4b5a6  add_weekly_reflections_table
19  a7b8c9d0e1f2  add_star_logs_table
20  e1f2a3b4c5d6  add_shop_rewards_table
21  f2a3b4c5d6e7  add_accountability_invites_and_partners
22  c7d9e1f2a3b4  add_coach_sessions_and_messages
23  d1e2f3a4b5c6  add_achievement_reward_granted_to_goals
24  e2f3a4b5c6d7  add_is_user_added_to_daily_tasks
25  f3a4b5c6d7e8  add_notification_logs
26  b7c8d9e0f1a2  add_weekly_star_log_to_notification_log_type_constraint  ← current HEAD
```

### PR #107 — Stripe subscription (`add_subscriptions_table.py`)

**Problem**: The migration file uses revision ID `b7c8d9e0f1a2`, which already exists on
`main` (step 26 above — a completely different migration). The file also sets
`down_revision = "2f0f06807e03"` (step 6), creating a fork in the middle of the chain.

**Required edits before merging**:

1. Generate a fresh unique revision ID (e.g. `e3f4a5b6c7d8`) — use any hex string that
   does not appear in the existing chain.
2. In `apps/api/alembic/versions/add_subscriptions_table.py`:

```python
# Change:
revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, None] = "2f0f06807e03"

# To:
revision: str = "e3f4a5b6c7d8"          # new unique ID
down_revision: Union[str, None] = "b7c8d9e0f1a2"   # current tip on main
```

3. Rename the file to match the new revision ID:

```bash
git mv apps/api/alembic/versions/add_subscriptions_table.py \
       apps/api/alembic/versions/e3f4a5b6c7d8_add_subscriptions_table.py
```

After merging #107, the new tip is `e3f4a5b6c7d8`.

---

### PR #139 — Goal archiving (`add_goal_archived_at.py`)

**Problem**: The migration uses revision ID `a1b2c3d4e5f6`, which already exists on
`main` (step 12 — `stub_rescue_task_first_attempt.py`). The `down_revision` points to
`f7a8b9c1d2e3` (step 11), creating another mid-chain fork.

**Required edits before merging** (merge after #107, so tip is now `e3f4a5b6c7d8`):

1. Generate a fresh revision ID (e.g. `f6a7b8c9d0e1`).
2. In `apps/api/alembic/versions/add_goal_archived_at.py`:

```python
# Change:
revision = "a1b2c3d4e5f6"
down_revision = "f7a8b9c1d2e3"

# To:
revision = "f6a7b8c9d0e1"              # new unique ID
down_revision = "e3f4a5b6c7d8"         # tip after #107 merged
```

3. Rename the file:

```bash
git mv apps/api/alembic/versions/add_goal_archived_at.py \
       apps/api/alembic/versions/f6a7b8c9d0e1_add_goal_archived_at.py
```

After merging #139, the new tip is `f6a7b8c9d0e1`.

---

### PR #141 — Notification preferences (`add_notification_prefs.py`)

**No collision** — revision ID `a1b2c3d4e5f7` is unused on `main`.
The `down_revision` is `b7c8d9e0f1a2` (the old tip), which must be updated to point to
the tip **after #139** lands.

**Required edit before merging**:

In `apps/api/alembic/versions/add_notification_prefs.py`:

```python
# Change:
down_revision: Union[str, None] = "b7c8d9e0f1a2"

# To:
down_revision: Union[str, None] = "f6a7b8c9d0e1"   # tip after #139 merged
```

Rename the file to use the standard naming convention:

```bash
git mv apps/api/alembic/versions/add_notification_prefs.py \
       apps/api/alembic/versions/a1b2c3d4e5f7_add_notification_prefs.py
```

After merging #141, the new tip is `a1b2c3d4e5f7`.

---

### PR #131 — Goal notes (`add_goal_notes_table.py`)

**Collision fixed** — the original revision ID `a1b2c3d4e5f7` collided with #141
(notification preferences). The branch has already been patched: revision is now `c2d3e4f5a6b7`.

**Required edit before merging** (merge after #141, so tip is `a1b2c3d4e5f7`):

In `apps/api/alembic/versions/add_goal_notes_table.py`:

```python
# Change:
down_revision: Union[str, None] = "b7c8d9e0f1a2"

# To:
down_revision: Union[str, None] = "a1b2c3d4e5f7"   # tip after #141 merged
```

After merging #131, the new tip is `c2d3e4f5a6b7`.

---

### Checklist — Migrations in merge order

```
[ ] Verify: alembic heads  → only one head (b7c8d9e0f1a2) before starting

[ ] PR #107  Edit add_subscriptions_table.py:
            revision  → e3f4a5b6c7d8
            down_revision → b7c8d9e0f1a2
            Rename file → e3f4a5b6c7d8_add_subscriptions_table.py
            Merge PR #107
[ ] Verify: alembic heads  → only one head (e3f4a5b6c7d8)

[ ] PR #139  Edit add_goal_archived_at.py:
            revision  → f6a7b8c9d0e1
            down_revision → e3f4a5b6c7d8
            Rename file → f6a7b8c9d0e1_add_goal_archived_at.py
            Merge PR #139
[ ] Verify: alembic heads  → only one head (f6a7b8c9d0e1)

[ ] PR #141  Edit add_notification_prefs.py:
            down_revision → f6a7b8c9d0e1
            Rename file → a1b2c3d4e5f7_add_notification_prefs.py
            Merge PR #141
[ ] Verify: alembic heads  → only one head (a1b2c3d4e5f7)

[ ] PR #131  Edit add_goal_notes_table.py:
            down_revision → a1b2c3d4e5f7   (revision ID already fixed to c2d3e4f5a6b7)
            Rename file → c2d3e4f5a6b7_add_goal_notes_table.py
            Merge PR #131
[ ] Verify: alembic heads  → only one head (c2d3e4f5a6b7)
```

---

## 3. Files With Multiple PR Conflicts

The following files will need manual conflict resolution on the second (and later) merges.

### `apps/api/models.py`

Modified by: #107 (adds `Subscription` model), #108 (reads `subscription.plan`),
#118 (no direct model change), #128 (no model change — analytics route),
#139 (adds `archived_at` column to `Goal`), #141 (adds notification pref columns to `User`)

**Strategy**: Keep all new model classes and new `mapped_column` additions. The merge
order matters:
- After #107: accept the new `Subscription` class at the bottom of the file.
- After #139: accept the new `archived_at` column inside the `Goal` class.
- After #141: accept the new `reminder_time`, `reminder_days`, `email_digest_enabled`,
  and `push_enabled` columns inside the `User` class. These are additions only — there
  should be no lines to delete.

When you see a conflict, keep **both** sets of additions. Do not drop any column
definition from either side.

### `apps/api/schemas.py`

Modified by: #107, #108 (feature gate schemas), #121 (collectible schemas),
#128 (analytics schemas), #138 (pagination schemas), #139, #141

**Strategy**: Pydantic schemas are additive. Keep every new `class` definition and every
new field. When a base class such as `GoalBase` gains fields from multiple PRs, include
all new fields — they do not conflict logically, only textually.

### `apps/api/main.py`

Modified by: #107 (registers `/billing` router), #118 (Celery startup event),
#122 (Sentry init), #123 (rate-limit middleware), #128 (registers analytics router),
#135 (registers `/health` router), `feature/error-response-format` (adds global
`http_exception_handler`), `feature/data-export` (registers `/export` router)

**Strategy**: This file is almost entirely a list of `app.include_router(...)` calls and
startup hooks. Keep every line from every PR — none of them remove existing routers.
Order does not matter for correctness; keep alphabetical or group by domain.
The `http_exception_handler` from `feature/error-response-format` must also be kept —
it is what rewrites raw `HTTPException` details into the canonical
`{"error": {"code", "message", "status"}}` shape.

### `apps/api/config.py`

Modified by: `feature/startup-validation` (adds `stripe_secret_key: str = ""` and
`sentry_dsn: str = ""`), `feature/stripe-subscription` (adds `stripe_secret_key`,
`stripe_webhook_secret`, `stripe_pro_price_id`), `feature/celery-redis-queue` (adds
`redis_url`), `feature/redis-rate-limiting` (adds rate-limit settings),
`feature/sentry-integration` (adds `sentry_dsn` with environment logic)

**Strategy**: All changes are new `Settings` fields — keep every field from every PR.
Watch for these specific duplicates when resolving:
- `stripe_secret_key: str = ""` appears in **both** `feature/startup-validation` (as a
  workaround) and `feature/stripe-subscription` (proper). Keep the `stripe-subscription`
  version (it also adds `stripe_webhook_secret` and `stripe_pro_price_id`).
- `sentry_dsn: str = ""` appears in **both** `feature/startup-validation` and
  `feature/sentry-integration`. Keep the `sentry-integration` version (it may have
  richer logic). The field only needs to appear once.

### `apps/api/routes/goals.py`

Modified by: #108 (adds plan-gate checks), #128 (no change — analytics is separate
route file), #138 (adds cursor pagination), #139 (adds archive/unarchive endpoints),
#140 (adds `?search=` query parameter to list endpoint)

**Strategy**: Each PR adds distinct endpoint functions or modifies the list query in a
localized way. Resolve conflicts by keeping all endpoint functions and combining query
modifications to the list function (pagination + search + archive filter can coexist in
one query).

### `apps/web/src/App.tsx`

Modified by: #109 (adds `<OnboardingGuard>` wrapper), #114 (wraps app in
`<ThemeProvider>`), #130 (adds error boundary + 404 route), `feature/code-splitting`
(converts all page imports to `React.lazy`), `feature/e2e-auth-guard-and-goal-type`
(adds E2E console warning)

**Strategy**: Merge `feature/code-splitting` **last** among these since it rewrites
all `import` statements to `lazy(() => import(...))`. When merging the others first
(onboarding-flow, dark-light-mode, error-pages), keep static imports. After all are
merged, apply code-splitting on top:

1. Convert **every** page import (including `NotFoundPage`, `OfflinePage` from
   error-pages and any pages added by onboarding/dark-mode) to `React.lazy`.
2. Wrap the entire `<Routes>` block in `<Suspense fallback={<PageLoadingFallback />}>`.
3. The `PageLoadingFallback` component is in `feature/code-splitting`; add it too.

Provider nesting in the final `App`: `ThemeProvider → ErrorBoundary → Suspense → Router
→ OnboardingGuard → Routes`. The E2E guard log from `feature/e2e-auth-guard-and-goal-type`
is a top-level `if (isE2EMode)` warning — keep it verbatim.

### `apps/web/src/pages/Dashboard.tsx`

**Most contested frontend file** — modified by 10 branches: `feature/accessibility`,
`feature/dark-light-mode`, `feature/goal-archiving`, `feature/goal-search`,
`feature/keyboard-shortcuts`, `feature/onboarding-flow`, `feature/progress-sharing`,
`feature/query-error-boundaries`, `feature/skeleton-loading`, `feature/upgrade-prompts`

**Strategy**: Merge in tier order, combining all changes. Since every PR touches a
different part of the component (filter tabs, goal list, header, modals), there are
rarely outright logic conflicts — just JSX structure collisions that need manual
combination. Suggested merge order within Tier 4:

1. `feature/dark-light-mode` — adds `ThemeProvider` context access
2. `feature/onboarding-flow` — adds `OnboardingGuard` and wizard rendering
3. `feature/upgrade-prompts` — adds paywall modal trigger logic
4. `feature/goal-search` — adds search input to filter bar
5. `feature/goal-archiving` — adds archived-goals tab/toggle
6. `feature/progress-sharing` — adds share button and `<ShareModal>`
7. `feature/keyboard-shortcuts` — adds `<KeyboardShortcutsModal>` and `onOpenShortcuts` prop
8. `feature/skeleton-loading` — replaces loading spinner with skeleton cards
9. `feature/query-error-boundaries` — wraps goal list in `<QueryErrorBoundary>`
10. `feature/accessibility` — adds ARIA attributes to the fully-merged file

Keep all changes from all PRs — none of them intentionally remove existing functionality.

### `apps/web/src/pages/Analytics.tsx`

Modified by: `feature/skeleton-loading` (adds skeleton placeholders), `feature/query-error-boundaries`
(wraps data sections in `<QueryErrorBoundary>`)

**Strategy**: Both changes are additive to the same JSX sections. Merge skeleton-loading first, then
manually add the `<QueryErrorBoundary>` wrappers around the data-fetching sections.

### `apps/web/src/components/GoalCard.tsx`

Modified by: `feature/split-components` (major structural refactor — extracts
`GoalCardHeader`, `GoalCardMilestones`, `GoalCardActions` sub-components) and
`feature/accessibility` (adds `role`, `aria-label`, `aria-live` attributes)

**Strategy**: Merge `feature/accessibility` **first** since it makes smaller, targeted
attribute additions. After it lands, merge `feature/split-components`. At that point the
accessibility attributes added to the monolithic `GoalCard.tsx` will need to be moved
into the appropriate sub-components:
- `role="article"` and top-level `aria-label={goal.smart_title}` → outer wrapper in `GoalCard.tsx`
- `role="status"` / `aria-live="polite"` on the badge row → `GoalCardHeader.tsx`
- `aria-label="Complete goal"` on the complete-goal button → `GoalCardActions.tsx`

### `apps/web/src/lib/types.ts`

Modified by: #107, #108, #113, #114, #115, #138, #139, #141

**Strategy**: This file is a collection of TypeScript interface declarations. Every PR
adds new interfaces or new optional fields to `Goal` / `User`. Keep all additions. When
a field appears on both sides of a conflict, keep the more permissive type (usually
`string | null` over `string`).

### `apps/api/utils.py`

Modified by: `feature/centralize-timezone` (Tier 1 — rewrites the file with a full set of
timezone helpers) and `feature/pagination` (Tier 5 — appends `encode_cursor`/`decode_cursor`).

**Strategy**: `feature/centralize-timezone` lands first (Tier 1). After it merges, the file
has the expanded timezone API but **no cursor helpers**. When merging `feature/pagination`
(Tier 5), manually append the two cursor functions from its version of `utils.py`:

```python
import base64

def encode_cursor(value: str) -> str:
    """Base64-encode a cursor value (any string, e.g. an ISO timestamp or UUID)."""
    return base64.urlsafe_b64encode(value.encode()).decode()

def decode_cursor(cursor: str) -> str:
    """Base64-decode a cursor back to its original string value."""
    return base64.urlsafe_b64decode(cursor.encode()).decode()
```

Add the `import base64` at the top of the file with the other imports.

### `apps/api/services/subscription_service.py`

Created by: #108 (`feature/feature-gating`) with a real `get_user_plan` + `require_pro`
implementation. Also created from scratch by: `feature/data-export` as a stub (always
returns Pro = True until billing is wired).

**Strategy**: Merge `feature/feature-gating` (#108) **before** `feature/data-export`.
When merging the data-export PR, discard the stub `subscription_service.py` it brings
(keep the #108 version which is more complete). The data-export route only calls
`require_pro(user_id, db, "export")` — that function exists in the #108 version so
no further changes are needed.

### `docker-compose.yml`

Created by: `feature/docker-compose` (comprehensive, includes healthchecks, dev
Dockerfiles, celery workers). Also partially created by: `feature/celery-redis-queue`
(adds celery services to a simpler compose).

**Strategy**: Merge `feature/docker-compose` **first**. When merging
`feature/celery-redis-queue`, discard the `docker-compose.yml` changes it brings —
the complete version from `feature/docker-compose` already includes all celery services.
Only keep the `celery_app.py`, `tasks/`, and other Python changes from that PR.

### `apps/web/vite.config.ts`

Modified by: `feature/e2e-auth-guard-and-goal-type` (adds `e2e-mode-guard` Vite plugin that
throws on production VITE_E2E_MODE builds) and `feature/code-splitting` (adds
`build.rollupOptions.output.manualChunks` for vendor splitting)

**Strategy**: The changes touch different parts of the config object — plugins vs build.
The combined final config should contain both:
```ts
export default defineConfig({
  plugins: [{ name: 'e2e-mode-guard', ... }, react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: { manualChunks: { 'vendor-react': [...], ... } },
    },
  },
})
```
No lines conflict; this is a merge combination, not a choice.

### `apps/web/public/sw.js`

Modified by: `feature/service-worker-caching` (Tier 2) and `feature/mobile-pwa` (Tier 4).

**Strategy**: `feature/service-worker-caching` lands first (Tier 2). When merging
`feature/mobile-pwa`, keep the service-worker-caching version as the base and
cherry-pick only the PWA-specific additions from mobile-pwa (install prompt, manifest
icon paths). The service-worker-caching version is more complete in its caching
strategy — do not revert it.

### `.github/workflows/ci.yml`

Modified by: `feature/ci-improvements` (Tier 1) — comprehensive rewrite with separate
lint/test jobs, concurrency groups, coverage reports, Python 3.13, Node 22.
Also modified by: `feature/ci-migration-check` (refinement) — adds `alembic check` and
single-head validation steps.

**Strategy**: Merge `feature/ci-improvements` first (it has the more complete job
definitions). When merging `feature/ci-migration-check`, discard the new
`backend-test` job it adds (the one from `feature/ci-improvements` is better) and
instead manually insert the two migration-check steps into the existing `backend-test`
job after the `alembic upgrade head` step:

```yaml
- name: Check migration completeness
  run: alembic check

- name: Check for migration head conflicts
  run: |
    HEADS=$(alembic heads | wc -l)
    if [ "$HEADS" -gt 1 ]; then
      echo "ERROR: Multiple migration heads detected:"
      alembic heads
      exit 1
    fi
    echo "Migration chain is clean (single head)"
```

---

## 4. Quick-Start Commands

### Before merging any migration PR

```bash
# From the repo root — confirm only one Alembic head
cd apps/api
alembic heads
# Expected single head before any feature merges:
# b7c8d9e0f1a2 (head)
```

### After merging each migration PR

```bash
# Confirm the new single head
alembic heads

# If you accidentally end up with two heads (forgot to update down_revision):
alembic merge heads -m "merge_feature_branches"
# Then commit the generated merge migration before proceeding
```

### Typical merge workflow for a migration PR

```bash
# 1. Check out the feature branch locally
git fetch origin
git checkout feature/stripe-subscription   # example

# 2. Edit the migration file (update revision + down_revision + rename)
#    See Section 2 for exact values

# 3. Stage the renamed file
git add apps/api/alembic/versions/

# 4. Merge into main
git checkout main
git merge --no-ff feature/stripe-subscription
# Resolve any conflicts in models.py / schemas.py / main.py (see Section 3)
git add apps/api/
git commit

# 5. Verify no multiple heads
cd apps/api && alembic heads
```

### Generating a fresh Alembic revision ID

```bash
python3 -c "import uuid; print(uuid.uuid4().hex[:12])"
```

Use the output as the new `revision` value and as the prefix of the renamed file.

### Checking which files a feature branch touches

```bash
git diff main..feature/<branch-name> --name-only
```

### Running the test suite after each tier

```bash
# API tests
cd apps/api
pytest tests/ -x -q

# Web type-check
cd apps/web
npm run tsc --noEmit
```
