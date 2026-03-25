# Adaptive Energy Check-in (Task Resizer) — Design Spec

**Date:** 2026-03-25
**Status:** Approved (post-review revision 1)

## Problem

Users on a "low energy" day get overwhelmed by their assigned tasks, leading to avoidance,
shame, and Day 3 churn. The feature intercepts these users via the daily digest email (deep
link) and an in-app Dashboard modal, then uses Gemini to fragment each of today's pending
tasks into an absurdly small, 3-minute first step.

## Out of Scope (MVP)

- Native mobile push notifications
- Tracking energy levels over time for analytics

---

## 1. Data Model

### Migration

Two nullable columns added to `daily_tasks`:

```sql
ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS original_description VARCHAR;
ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS original_tip VARCHAR;
```

**Migration implementation note (CLAUDE.md catch-up pattern):** `Base.metadata.create_all`
in `lifespan` auto-creates tables before Alembic runs in development. Because the table
already exists, the migration must use `op.execute("ALTER TABLE daily_tasks ADD COLUMN IF
NOT EXISTS original_description VARCHAR")` (not `op.add_column`) to remain idempotent on
both fresh and existing databases. Use `if_not_exists=True` on any index added by this
migration.

### Semantics

- Both columns default to `NULL` (no overhead on normal tasks).
- A non-null `original_description` is the canonical signal that a task is currently in
  "resized" state. All idempotency checks, UI Restore button visibility, and restore logic
  key off this single field.
- On resize: `original_description = description; original_tip = tip; description = <micro>;
  tip = <empathetic tip>`.
- On restore: `description = original_description; tip = original_tip;
  original_description = NULL; original_tip = NULL`.

### Schema changes

`TaskResponse` (and `schemas.py`) gains two optional fields:

```python
original_description: str | None = None
original_tip: str | None = None
```

These fields also appear on `TaskCompleteResponse` (which inherits `TaskResponse`) — this
is harmless; both will always be `None` during normal task completion.

`Task` interface in `src/lib/types.ts` gains the same two optional fields:

```ts
original_description?: string | null;
original_tip?: string | null;
```

---

## 2. AI Prompt

### New function in `ai_utils.py`

```python
async def resize_task_for_low_energy(
    goal_context: str,
    sprint_theme: str,
    original_description: str,
    assigned_date: date,
) -> AITaskOutput:
```

Reuses the existing `AITaskOutput` schema and `_with_retry` wrapper (retry logic + 30s
timeout inherited for free). No new Pydantic model needed.

**Important:** `AITaskOutput` contains an `assigned_date` field. When the resize endpoint
writes results back to the DB, **only `result.description` and `result.tip` are consumed.**
`result.assigned_date` is explicitly discarded — the task's `assigned_date` must never be
overwritten by the AI response.

### System prompt constant `_ENERGY_RESIZE_PROMPT`

```
You are GoalForge AI helping a user who is low on energy today.
Original task: {original_description}
Goal context: {goal_context}
Sprint theme: {sprint_theme}

Your job is to find the single, absurdly small FIRST STEP that physically initiates this task.

Rules:
- The micro-task MUST be the literal first physical or digital action toward the original task.
  (e.g. "Open your notes app" not "Review your notes strategy")
- It must be completable in under 3 minutes.
- The description MUST start with a strong action verb: Open, Put on, Type, Pull up, Set, Write.
- Keep description <= 15 words.
- The tip MUST be empathetic and zero-pressure.
  Good: "Just doing this is a win today." Bad: "Stay consistent!"
- Keep tip <= 15 words.
- Do NOT invent a thematic alternative. Stay anchored to the original task.
- Use the same assigned_date: {assigned_date}.
```

### Design rationale

The "first step" framing addresses ADHD-style task-initiation paralysis directly. A
"thematic alternative" would feel like busywork and leave guilt intact. Strict anchoring to
the original task means completing the micro-task genuinely counts as starting the real work.

---

## 3. Backend API

### New file: `routes/energy.py`

Kept separate from `routes/tasks.py` (already 270 lines) to keep the feature self-contained.
Router included in `main.py` via `app.include_router(energy_router, tags=["energy"])`.

---

#### `POST /users/{user_id}/energy-resize`

**Auth:** Clerk JWT (`get_current_user_id`)
**Rate limit:** 3/hour per user (expensive — up to 10 Gemini calls). Note: the existing
global slowapi 429 handler in `main.py` returns `Retry-After: 60` for all rate-limit
responses — this is a known limitation of the shared handler and is acceptable for MVP.
**Request body:** None

**Logic:**

1. Load user row → derive `today = user_today(user.timezone)`.
2. Query all today's pending non-completed tasks across all active goals for this user
   (JOIN `daily_tasks → goals` WHERE `goals.user_id = user_id AND goals.status = 'active'
   AND assigned_date = today AND is_completed = false`).
3. Split into `to_resize` (where `original_description IS NULL`) vs `already_resized`.
4. If `to_resize` is empty → return 200 with current tasks (idempotent; no Gemini calls).
5. Cap `to_resize` at 10; batch-load `goal_context` + `sprint_theme` for each task via a
   single query joining `goals` and `milestones`.
6. Run Gemini calls in parallel with per-task failure isolation:

   ```python
   results = await asyncio.gather(
       *[resize_task_for_low_energy(...) for t in to_resize],
       return_exceptions=True,
   )
   ```

   Post-process: zip `to_resize` with `results`; skip any result that is an `Exception`
   (log a warning for it). Only write back tasks where the result is a valid `AITaskOutput`.

7. Write all successful results in a single transaction. For each succeeded task:
   ```python
   task.original_description = task.description
   task.original_tip = task.tip
   task.description = result.description   # only description and tip — never assigned_date
   task.tip = result.tip
   ```
8. Return `EnergyResizeResponse`:

```python
class EnergyResizeResponse(BaseModel):
    tasks_resized: int
    tasks: list[TaskResponse]  # full day's pending tasks (newly resized + already-resized)
```

---

#### `POST /tasks/{task_id}/restore`

**Auth:** Clerk JWT with ownership check
**Guards:**
- `original_description IS NULL` → 400 "Task is not in resized state"
- `is_completed` → 400 "Cannot restore a completed task"

**Logic:** Swap description+tip back from `original_` columns; null both `original_` columns.
**Returns:** `TaskResponse`

---

### Email trigger

`_build_digest_html` in `email_service.py` gains a CTA block below the task table:

```html
<a href="https://goalforge.app/dashboard?energy=low"
   style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);
          color:#fff;font-weight:600;font-size:14px;padding:12px 24px;
          border-radius:8px;text-decoration:none;margin-top:20px;">
  Low energy today? Simplify everything &rarr;
</a>
```

No user IDs or task IDs in the URL — the backend resolves everything from the Clerk JWT.

---

## 4. Frontend

### 4a. `sessionStorage` persistence (`App.tsx`)

A new component `EnergyParamCapture` (rendered inside `ClerkProvider` but above `AuthGuard`
in `App.tsx`) uses `useSearchParams()` and `useEffect` to seed `sessionStorage`:

```tsx
function EnergyParamCapture() {
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('energy') === 'low') {
      sessionStorage.setItem('pending_energy_mode', 'true');
    }
  }, [searchParams]);
  return null;
}
```

This runs before `AuthGuard` can redirect, capturing the param regardless of auth state.
It renders `null` — no visual output.

On Dashboard mount (after confirming the user is signed in), the Dashboard reads and clears
the `sessionStorage` key. The `?energy=low` param is removed from the URL via
`history.replaceState` to prevent modal loops on page refresh.

**Why not inside `AuthGuard`:** `AuthGuard` uses Clerk's `<Show>` component, which manages
the redirect internally. There is no pre-redirect hook available in this pattern.
`EnergyParamCapture` is the correct insertion point.

### 4b. `EnergyModal.tsx` (new component)

A lightweight confirmation overlay — not full-screen. Triggered by:
- Dashboard detecting `?energy=low` in URL params, OR
- Dashboard detecting `pending_energy_mode` in `sessionStorage`, OR
- User clicking the organic trigger in `TodayBar`

**Content:** "Feeling low energy today? I'll shrink all your tasks into 3-minute first steps."

**Actions:**
- `[Yes, simplify my day]` → calls `useEnergyResizeMutation`; on success:
  - Calls `invalidateQueries(queryKeys.goals(userId))` — the multi-goal task distribution
    across the paginated goals cache is complex enough that a single network refetch is
    cleaner and more reliable than manually merging a flat task list back into N goal objects
    via `setQueryData`
  - Clears `sessionStorage` key
  - Strips `?energy=low` from URL via `history.replaceState`
  - Shows toast: "Tasks simplified. You've got this."
- `[Never mind]` → dismisses modal, clears `sessionStorage` key

### 4c. Restore button in `DailyTaskList.tsx`

`TaskRow` receives the full task object. When `task.original_description` is non-null,
render a small ghost `Restore` button inline (right of the description).

- Clicking fires `restoreTask` mutation → `POST /tasks/{task_id}/restore`
- Optimistic update: immediately clear `original_description` in cache and swap
  description/tip back
- On error: roll back

### 4d. Organic trigger in `TodayBar.tsx`

A "Low Energy Day" button placed alongside the existing Focus button. Visible only when:
- There are pending tasks today, AND
- None are currently resized (i.e., no task has `original_description` non-null)

Clicking it opens `EnergyModal`.

### New hook file: `src/hooks/useEnergyMutations.ts`

Two mutations in a dedicated file (following the `useRewards.ts` precedent — keeps
`useGoalMutations.ts` from growing beyond its current 12-mutation scope):

```ts
useEnergyResizeMutation(userId)   // POST /users/{user_id}/energy-resize
useRestoreTaskMutation(userId)    // POST /tasks/{task_id}/restore
```

`EnergyModal` is instantiated in `Dashboard` (not in `GoalCard`) — consistent with
CLAUDE.md's "Mutation prop lifting for overlays" rule. The `confirmResize` handler comes
from Dashboard's mutation instance.

---

## 5. Error Handling

| Scenario | Handling |
|---|---|
| Gemini call fails for one task | `asyncio.gather(return_exceptions=True)` — failed task skipped, logged; others succeed |
| All Gemini calls fail | `tasks_resized: 0` in response; 200 returned with unchanged tasks; no 503 needed |
| User hits rate limit (3/hour) | 429 from slowapi; `Retry-After: 60` (global handler limitation) |
| `energy=low` param on already-resized day | Idempotent: returns 200 with existing tasks, no Gemini calls |
| Restore on non-resized task | 400 "Task is not in resized state" |
| Restore on completed task | 400 "Cannot restore a completed task" |

---

## 6. Testing

- **Unit**: `resize_task_for_low_energy` prompt construction (mock Gemini client)
- **Integration**:
  - `POST /users/{user_id}/energy-resize` — bulk mutation, idempotency (all already resized),
    cap at 10, partial Gemini failure skips the failed task only (`return_exceptions=True`),
    rate limit
  - `POST /tasks/{task_id}/restore` — swap + null clear, ownership guard, already-restored
    guard, completed-task guard
- **Email**: `_build_digest_html` HTML contains `?energy=low` CTA link
- **Frontend**: `EnergyParamCapture` seeds `sessionStorage` when param present; clears on
  Dashboard mount; `EnergyModal` fires mutation on confirm, dismisses on cancel; Restore
  button hidden when `original_description` is null, visible when non-null

---

## 7. CLAUDE.md Updates Required

After implementation:

- Add `routes/energy.py` to key files table
- Add `POST /users/{user_id}/energy-resize` and `POST /tasks/{task_id}/restore` to API
  endpoints table
- Add `resize_task_for_low_energy` to `ai_utils.py` entry
- Add `original_description`, `original_tip` to data model section
- Add `EnergyModal.tsx` and `EnergyParamCapture` to frontend key files table
- Add `useEnergyMutations.ts` to hooks table
- Note `sessionStorage` + `EnergyParamCapture` pattern for deep-link param persistence
