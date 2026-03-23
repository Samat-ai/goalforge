# GoalForge Part 1 Critical Fixes — Design Spec

**Date:** 2026-03-22
**Scope:** Four critical stability and integrity fixes identified in the Strategic Current-State Review.

---

## Overview

Four issues are addressed in this spec, in priority order:

1. **Race condition on task completion** — double +10 star point awards
2. **Race condition on goal achievement** — double +100 star point awards
3. **Stuck "generating" milestones on worker restart** — non-durable asyncio tasks leave milestones stranded
4. **Blocking AI path on goal creation** — synchronous Gemini call holds HTTP connection for up to 90s

Issues 3 and 4 share a single schema change (`Milestone.generation_started_at`) and are designed to complement each other.

---

## Issue 1 — Race Condition on Task Completion (+10 points)

### Problem

`_load_task_with_ownership` in `routes/tasks.py` performs a plain `SELECT` on the task row. The `complete_task` endpoint checks `task.is_completed` and raises 400 if already done — but without a row lock, two concurrent requests both pass this check before either commits, resulting in double point awards.

### Fix

Add `.with_for_update()` to the task `SELECT` inside `_load_task_with_ownership`. This causes the second concurrent request to block at the database until the first transaction commits, at which point it reads `is_completed = True` and correctly returns 400.

### Scope

- `apps/api/routes/tasks.py` — `_load_task_with_ownership` helper: change `select(DailyTask).where(...)` to `select(DailyTask).where(...).with_for_update()`

### Consistency

This matches the existing pattern in `routes/milestones.py`, where both `complete_milestone` and `retry_sprint_generation` already use `.with_for_update()` on milestone SELECTs.

---

## Issue 2 — Race Condition on Goal Achievement (+100 points)

### Problem

`update_goal_status` in `routes/goals.py` reads `old_status = goal.status`, then checks `if body.status == "achieved" and old_status != "achieved"`. Without a row lock, two concurrent requests both observe `old_status != "achieved"` and both execute the `+100` UPDATE.

### Fix

Add `.with_for_update()` to the **second** `select(Goal)` inside `update_goal_status` (lines 185–190 in the current file). This is the query that reads `goal.status` and initiates the point award logic.

**Important:** `update_goal_status` performs two SELECTs:
1. `_load_goal_with_ownership(goal_id, ...)` — a shared helper in `deps.py` used only as a 403/404 guard; its result is discarded. Do NOT add `.with_for_update()` here — this helper is also called by non-mutating endpoints (`get_goal`, `update_goal_progress`, `delete_goal`) where locking is inappropriate.
2. The dedicated `select(Goal).options(selectinload(...)).where(Goal.id == goal_id)` — this is where `old_status` is read. Add `.with_for_update()` here only.

The point award SQL (`User.star_points + 100`) is already atomic — the only gap is the idempotency guard, which the row lock closes.

### Scope

- `apps/api/routes/goals.py` — `update_goal_status`: add `.with_for_update()` to the dedicated second `select(Goal)` query, not to the `_load_goal_with_ownership` call

---

## Issue 3 — Stuck "Generating" Milestones on Worker Restart

### Problem

Sprint pre-generation uses `asyncio.create_task(_pre_generate_sprint(...))`. When a uvicorn worker restarts mid-task, the coroutine is silently dropped. The milestone remains in `sprint_status = "generating"` indefinitely. The existing retry endpoint only rescues `"failed"` milestones, not `"generating"` ones, so users are permanently stuck with no recovery path.

### Fix: Timestamp + Lazy Evaluation

**Schema change:** Add `generation_started_at` (`DateTime(timezone=True)`, nullable, UTC) to the `Milestone` model. Set it when `sprint_status` transitions to `"generating"`.

**Lazy evaluation:** In `list_goals` (`GET /users/{user_id}/goals`), after loading the paginated goal+milestone result, scan all milestones. For any milestone where `sprint_status == "generating"` AND `generation_started_at is not None` AND `generation_started_at < datetime.now(UTC) - timedelta(minutes=5)`, immediately update `sprint_status = "failed"` in the same DB session before returning the response.

The `generation_started_at is not None` guard is essential for milestones created before this migration runs — their `generation_started_at` will be `NULL`, and comparing `NULL < threshold` must not trigger a false positive.

The lazy scan fires on every poll during the generating window, but the timestamp filter means no actual DB writes occur for actively-processing milestones — only for genuinely stuck ones.

**Atomicity requirement:** The three changes below must ship in the same deployment (migration + code):
1. `models.py` — add `generation_started_at` column
2. `services/task_service.py` `_pre_generate_sprint` — set `generation_started_at` in the `"generating"` UPDATE
3. `routes/goals.py` `list_goals` — lazy eval scan

If the lazy eval lands without the column existing, the code will fail at startup. If `_pre_generate_sprint` does not set the timestamp, new stuck milestones will have `generation_started_at = NULL` and will never be rescued by the lazy eval.

**Why lazy over startup recovery:** A startup hook would reset legitimately-in-progress jobs from other workers in a multi-worker deployment, causing silent data corruption. Lazy evaluation is safe because it only acts on milestones that have been stuck long enough that no live task could still be processing them.

**Recovery UX:** The frontend already renders a "Retry Generation" button for `sprint_status == "failed"` milestones (via `SprintRail.tsx`). No frontend changes are required for this issue — the lazy eval surfaces the failure state and the existing UI handles it.

### Scope

- `apps/api/models.py` — add `generation_started_at = Column(DateTime(timezone=True), nullable=True)` to `Milestone`
- `apps/api/alembic/versions/<new>.py` — migration: `ADD COLUMN generation_started_at TIMESTAMP WITH TIME ZONE` (see migration notes below)
- `apps/api/services/task_service.py` — `_pre_generate_sprint`: add `generation_started_at=datetime.now(timezone.utc)` to the `values(sprint_status="generating")` UPDATE (lines 86–91)
- `apps/api/routes/goals.py` — `list_goals`: lazy eval scan + UPDATE before returning response

Note: `retry_sprint_generation` in `milestones.py` is synchronous — it never transitions through `"generating"` state. No changes needed there for Issue 3.

---

## Issue 4 — Two-Phase Async Goal Creation

### Problem

`POST /users/{user_id}/goals` calls `generate_smart_goal()` synchronously — up to 3 retries × 30s = 90s worst case. Under burst traffic, all workers hold open HTTP connections awaiting Gemini. The UX impact is equally severe: users stare at a loading spinner after a high-motivation goal submission.

### Fix: Two-Phase Creation with FastAPI BackgroundTasks

**Phase 1 (synchronous, < 100ms):**

1. Save `User` row (upsert as before)
2. Capture `user_timezone = user.timezone` for use in the background task
3. Save `Goal` row with placeholder values:
   - `smart_title = raw_input` (user's own words — readable placeholder)
   - `smart_description = ""`
   - `goal_type = "personal"`
   - `target_date = today + 35 days` (5 sprints × 7 days)
4. Save ONE placeholder `Milestone`:
   - `title = "Generating your plan…"` ← this exact string is the sentinel for retry detection
   - `position = 1`, `is_final = False`
   - `sprint_status = "generating"`
   - `generation_started_at = datetime.now(timezone.utc)`
5. Enqueue `_generate_goal_async` via FastAPI `BackgroundTasks`
6. Return **202** (change decorator from `status.HTTP_201_CREATED` to `status.HTTP_202_ACCEPTED`) with the goal (placeholder milestone included)

**Why `BackgroundTasks` here instead of `asyncio.create_task`:**
FastAPI's `BackgroundTasks` is the correct tool when the background work is enqueued from a route handler, because FastAPI holds a reference to the tasks — no module-level strong-reference set (`_background_tasks`) is needed. The `asyncio.create_task` pattern (with `_background_tasks` set and `_log_task_exception` callback) is used in `task_service.py` because `_pre_generate_sprint` is triggered from inside a business-logic service that has no access to the request's `BackgroundTasks` object. Do not mix the patterns: route handlers → `BackgroundTasks`; service-layer fire-and-forget → `asyncio.create_task` + strong-ref set.

**Phase 2 (background, after response sent):**

Implemented in new file `apps/api/services/goal_service.py` as `_generate_goal_async(goal_id, user_id, user_timezone, raw_input)`:

1. Opens own `AsyncSession(engine)` — same pattern as `_pre_generate_sprint`
2. Calls `generate_smart_goal(raw_input, today=user_today(user_timezone))`
   - `user_timezone` is passed in from Phase 1 (captured from `user.timezone` after the upsert)
3. **On success:**
   - Updates `Goal`: `smart_title`, `smart_description`, `goal_type`, `target_date`
   - Deletes the placeholder `Milestone` (identified by `goal_id` and `title == "Generating your plan…"`)
   - Creates real `Milestone` rows from AI output
   - Creates `DailyTask` rows for sprint 1
4. **On `AIGenerationError`:**
   - Sets placeholder `Milestone.sprint_status = "failed"`
   - Goal remains with placeholder values (raw_input as title is acceptable)

**Recovery:** If the worker restarts between Phase 1 and Phase 2, the placeholder milestone stays in `"generating"` with `generation_started_at` set. The Issue 3 lazy eval resets it to `"failed"` on the user's next `GET /goals`. The retry flow (below) then completes the generation.

### Retry for Initial Goal Generation Failure

The existing `POST /goals/{goal_id}/milestones/{milestone_id}/retry-generation` endpoint is extended. The current status guard accepts `sprint_status in ("failed", "active")` — this does not change. After the lazy eval resets the stuck placeholder milestone to `"failed"`, it will correctly enter the retry handler.

Inside the retry handler, detect initial-creation failure using the sentinel title:

- **Detection:** `milestone.title == "Generating your plan…"` (the exact placeholder title from Phase 1)
- **On match:** Call `_generate_goal_async(goal_id, user_id, user_timezone, goal.raw_input)` as a background task. The `user_timezone` value comes from `user_obj.timezone` — `retry_sprint_generation` already loads `user_obj` from the DB to compute `today`, so the timezone is available without an extra query.
- **Otherwise:** Proceed with existing sprint task generation logic

Using the milestone title as sentinel is more robust than `smart_description == ""` (which could theoretically be a valid AI response) and avoids adding a new DB column.

### Frontend Changes

The loading state predicate throughout is: `goal.milestones[0]?.sprint_status === "generating"`.

- **Goal card skeleton:** When the predicate is true, render a skeleton/loading variant of the goal card instead of the normal task list. Show `goal.smart_title` (user's raw input) as the title.
- **`goal_type` badge suppression:** When the predicate is true, do not render the `goal_type` badge. The placeholder value `"personal"` is a hardcoded default and not a real AI classification — displaying it before generation completes is misleading.
- **Polling:** The existing `useGoals.ts` already polls at 5-second intervals when any goal is in `"generating"` state (confirmed: `GENERATING_POLL_MS = 5_000`). No change to the interval is needed. Verify the polling trigger condition covers the new placeholder milestone structure.
- **Failed state:** `"failed"` on the first milestone shows the existing retry button — no new UI needed.

### New File

`apps/api/services/goal_service.py` — contains `_generate_goal_async` coroutine. The `routes/goals.py` `create_goal` handler becomes thin: save placeholder rows, enqueue background task, return 202.

### Scope

- `apps/api/services/goal_service.py` — new file, `_generate_goal_async` background generation logic
- `apps/api/routes/goals.py` — `create_goal`: phase 1 only; change status code decorator to `HTTP_202_ACCEPTED`; enqueue background task; return
- `apps/api/routes/milestones.py` — `retry_sprint_generation`: add `background_tasks: BackgroundTasks` to the function signature (and `from fastapi import BackgroundTasks` to imports); add sentinel-based branch to detect initial creation failures and route to `_generate_goal_async` via `background_tasks.add_task(...)`
- `apps/api/schemas.py` — verify `GoalResponse` serializes correctly with empty `smart_description` (no `min_length` validator — already fine)
- `apps/web/src/hooks/useGoals.ts` — verify polling trigger covers new placeholder milestone structure (no interval change needed)
- `apps/web/src/components/GoalCard.tsx` — loading skeleton when first milestone `sprint_status === "generating"`; suppress `goal_type` badge in loading state

---

## Shared Schema Change

One Alembic migration covers both Issues 3 and 4:

```python
# SQLAlchemy model (models.py)
generation_started_at = Column(DateTime(timezone=True), nullable=True)
```

```sql
-- SQL migration
ALTER TABLE milestones ADD COLUMN generation_started_at TIMESTAMP WITH TIME ZONE;
```

Nullable. Set to `datetime.now(timezone.utc)` whenever `sprint_status` transitions to `"generating"` — in `_pre_generate_sprint` (Issue 3) and in the Phase 1 placeholder milestone creation (Issue 4).

**Migration notes:**
- Use `alembic revision --autogenerate` to generate the migration. The plain `DateTime` column will be detected correctly.
- After autogenerate, **manually review** the generated migration file. Alembic `--autogenerate` does NOT detect `CheckConstraint` changes — if any check constraints exist on the `milestones` table, they will not appear in the generated file. Verify no constraint drift before running `upgrade head`.
- `DateTime(timezone=True)` in the SQLAlchemy model produces `TIMESTAMP WITH TIME ZONE` in PostgreSQL. Ensure consistency: all comparisons in the lazy eval must use timezone-aware datetimes (`datetime.now(timezone.utc)`, not `datetime.utcnow()`).

---

## What Is NOT in Scope

- Job queues, Celery, Redis, or any new infrastructure
- Two-phase creation for sprint generation (already handled by existing pre-gen + retry flow)
- JWT audience validation (flagged in security section of review — separate ticket)
- Any Part 2 product features (adaptive "Do One Thing" mode, reward variability, etc.)

---

## Testing Notes

- **Race condition tests:** use `asyncio.gather` to fire two concurrent complete/achieve requests; assert points awarded exactly once
- **Background task tests:** mock `services.goal_service._generate_goal_async` (follows the project's established patch path convention — see `CLAUDE.md`); assert Phase 1 returns 202 with placeholder milestone, assert background fn is called once
- **Lazy eval tests:** insert milestone with `sprint_status = "generating"` and `generation_started_at = now() - 10min`, call `GET /goals`, assert it returns as `"failed"`
- **Retry routing tests:** assert that a milestone with `title == "Generating your plan…"` routes to `_generate_goal_async`, not to `generate_sprint_tasks`
- Existing tests for task completion, milestone advance, and retry-generation must continue to pass
