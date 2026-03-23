# GoalForge Part 1 Critical Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four critical production bugs: two star-point race conditions, stuck "generating" milestones on worker restart, and a 90-second blocking goal creation UX.

**Architecture:** Row-locking closes the race conditions; a `generation_started_at` timestamp + lazy evaluation in `list_goals` rescues stuck milestones without new infrastructure; FastAPI `BackgroundTasks` decouples goal creation from AI latency.

**Spec:** `docs/superpowers/specs/2026-03-22-part1-critical-fixes-design.md`

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, PostgreSQL, Alembic, React 19, TanStack Query v5, TypeScript.

---

## File Map

**Modified:**
- `apps/api/routes/tasks.py:31-39` — add `.with_for_update()` to `_load_task_with_ownership`
- `apps/api/routes/goals.py:184-203` — lock second SELECT in `update_goal_status`; lazy eval scan in `list_goals`; Phase 1 two-phase rewrite of `create_goal`
- `apps/api/routes/milestones.py:121-171` — add `BackgroundTasks` + sentinel routing to `retry_sprint_generation`
- `apps/api/models.py:74-103` — add `generation_started_at` column to `Milestone`
- `apps/api/services/task_service.py:85-91` — set `generation_started_at` in `_pre_generate_sprint`
- `apps/api/tests/conftest.py` — add `_generate_goal_async` mock with DB side-effect, update `create_test_goal` to expect 202 + re-fetch
- `apps/api/tests/test_tasks.py` — add concurrent completion idempotency test
- `apps/api/tests/test_goals.py` — update `test_create_goal` for 202, add lazy eval + race condition tests
- `apps/api/tests/test_retry_generation.py` — add sentinel-routing test
- `apps/web/src/components/GoalCard.tsx` — loading skeleton + badge suppression

**Created:**
- `apps/api/services/goal_service.py` — `_generate_goal_async` background coroutine
- `apps/api/alembic/versions/<timestamp>_add_generation_started_at.py` — migration

---

## Task 1: Race Condition Fixes — Row Locking (Issues 1 & 2)

**Files:**
- Modify: `apps/api/routes/tasks.py:34`
- Modify: `apps/api/routes/goals.py:185`
- Modify: `apps/api/tests/test_tasks.py`
- Modify: `apps/api/tests/test_goals.py`

**Run all tests first to establish a clean baseline:**

```bash
cd /d/PyCharm/goalforge/apps/api
GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/ -v
```

Expected: all pass.

- [ ] **Step 1: Write failing-style test for task completion idempotency under concurrency**

Add to `apps/api/tests/test_tasks.py`:

```python
async def test_complete_task_concurrent_requests_award_points_once(client):
    """
    Two concurrent PATCH /tasks/{id}/complete requests must award +10 exactly once.
    SQLite serializes writes, so this tests idempotency behaviour.
    With .with_for_update() in place, the second request sees is_completed=True and returns 400.
    """
    import asyncio
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]

    pts_before = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]

    results = await asyncio.gather(
        client.patch(f"/tasks/{task_id}/complete"),
        client.patch(f"/tasks/{task_id}/complete"),
        return_exceptions=True,
    )
    status_codes = sorted([r.status_code for r in results if hasattr(r, "status_code")])
    assert status_codes == [200, 400], f"Expected one 200 and one 400, got {status_codes}"

    pts_after = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]
    assert pts_after == pts_before + 10, "Points must be awarded exactly once"
```

- [ ] **Step 2: Run — confirm test fails (before fix, both requests may return 200)**

```bash
GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_tasks.py::test_complete_task_concurrent_requests_award_points_once -v
```

Expected: FAIL (SQLite will likely serialize anyway so it may actually pass — either way, proceed).

- [ ] **Step 3: Fix `_load_task_with_ownership` in `routes/tasks.py`**

Change line 34 from:
```python
result = await db.execute(select(DailyTask).where(DailyTask.id == task_id))
```
To:
```python
result = await db.execute(select(DailyTask).where(DailyTask.id == task_id).with_for_update())
```

- [ ] **Step 4: Write concurrency test for goal achievement double-award**

Add to `apps/api/tests/test_goals.py`:

```python
async def test_achieve_goal_concurrent_requests_award_points_once(client):
    """
    Two concurrent PATCH /goals/{id} setting status='achieved' must award +100 exactly once.
    """
    import asyncio
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    pts_before = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]

    results = await asyncio.gather(
        client.patch(f"/goals/{goal_id}", json={"status": "achieved"}),
        client.patch(f"/goals/{goal_id}", json={"status": "achieved"}),
        return_exceptions=True,
    )
    # Both requests may return 200 (idempotent status update), but points awarded once
    for r in results:
        assert r.status_code == 200

    pts_after = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]
    assert pts_after == pts_before + 100, "Goal achievement bonus must be awarded exactly once"
```

- [ ] **Step 5: Fix `update_goal_status` in `routes/goals.py`**

The function has two SELECTs. Add `.with_for_update()` only to the **second** one (the dedicated goal SELECT around line 185, NOT the `_load_goal_with_ownership` call on line 184).

Change:
```python
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal_id)
    )
```
To:
```python
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal_id)
        .with_for_update()
    )
```

- [ ] **Step 6: Run all tests — confirm all pass**

```bash
GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/ -v
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd /d/PyCharm/goalforge
git add apps/api/routes/tasks.py apps/api/routes/goals.py apps/api/tests/test_tasks.py apps/api/tests/test_goals.py
git commit -m "fix: row-lock task/goal SELECTs to prevent double star-point awards"
```

---

## Task 2: Schema + Lazy Eval — Stuck Generating Milestones (Issue 3)

**Files:**
- Modify: `apps/api/models.py`
- Create: `apps/api/alembic/versions/<timestamp>_add_generation_started_at.py`
- Modify: `apps/api/services/task_service.py:85-91`
- Modify: `apps/api/routes/goals.py` — `list_goals` function
- Modify: `apps/api/tests/test_goals.py`

**Note:** All three changes (model, `_pre_generate_sprint`, `list_goals`) must ship together. The lazy eval's `None`-guard protects pre-existing rows.

- [ ] **Step 1: Write failing test for lazy eval**

Add to `apps/api/tests/test_goals.py`:

```python
async def test_list_goals_resets_stuck_generating_milestone_to_failed(client, engine):
    """
    A milestone stuck in 'generating' for >5 minutes is reset to 'failed'
    by the lazy eval in list_goals.
    """
    from datetime import datetime, timedelta, timezone
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
    from sqlalchemy import update as sql_update
    from models import Milestone

    # Create a goal (will have a real active milestone from mock)
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    milestone_id = goal["milestones"][0]["id"]

    # Directly force milestone into stuck 'generating' state with old timestamp
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        stale_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        await session.execute(
            sql_update(Milestone)
            .where(Milestone.id == milestone_id)
            .values(sprint_status="generating", generation_started_at=stale_time)
        )
        await session.commit()

    # list_goals should lazily reset it to 'failed'
    resp = await client.get(f"/users/{TEST_USER_ID}/goals")
    assert resp.status_code == 200
    milestones = resp.json()["items"][0]["milestones"]
    stuck_ms = next(m for m in milestones if m["id"] == str(milestone_id))
    assert stuck_ms["sprint_status"] == "failed", (
        "Milestone stuck in 'generating' for >5 min should be reset to 'failed'"
    )
```

- [ ] **Step 2: Run — confirm test fails (lazy eval not yet implemented)**

```bash
GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_goals.py::test_list_goals_resets_stuck_generating_milestone_to_failed -v
```

Expected: FAIL (milestone still shows `sprint_status = "generating"`).

- [ ] **Step 3: Add `generation_started_at` to `Milestone` model**

In `apps/api/models.py`, after the `completed_at` column (around line 100), add:

```python
    generation_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

The imports at the top of `models.py` already include `DateTime` and `datetime` — no new imports needed.

- [ ] **Step 4: Write the Alembic migration manually**

Do NOT use `--autogenerate` (requires live DB). Instead, find the latest migration file to determine the correct `down_revision`:

```bash
ls /d/PyCharm/goalforge/apps/api/alembic/versions/
```

Then create a new file `apps/api/alembic/versions/<timestamp>_add_generation_started_at.py`. Use the filename format matching existing files. Set `down_revision` to the hash of the latest existing migration.

```python
"""add generation_started_at to milestones

Revision ID: <generate a new short hex string, e.g. a1b2c3d4e5f6>
Revises: <hash of latest existing migration>
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = '<new_hex>'
down_revision = '<latest_existing_hash>'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'milestones',
        sa.Column('generation_started_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('milestones', 'generation_started_at')
```

**After writing, manually inspect the file — Alembic autogenerate silently omits `CheckConstraint` changes, but since we're writing manually this is already clean.**

- [ ] **Step 5: Run the migration**

```bash
cd /d/PyCharm/goalforge/apps/api
py -3 -m alembic upgrade head
```

Expected: `Running upgrade <prev> -> <new>, add generation_started_at to milestones`

- [ ] **Step 6: Set `generation_started_at` in `_pre_generate_sprint`**

In `apps/api/services/task_service.py`, find the `values(sprint_status="generating")` call (around line 88). Add `generation_started_at`:

Change:
```python
                await db.execute(
                    sql_update(Milestone)
                    .where(Milestone.id == milestone_id)
                    .values(sprint_status="generating")
                )
```
To:
```python
                await db.execute(
                    sql_update(Milestone)
                    .where(Milestone.id == milestone_id)
                    .values(sprint_status="generating", generation_started_at=datetime.now(timezone.utc))
                )
```

`datetime` and `timezone` are already imported in `task_service.py`.

- [ ] **Step 7: Implement lazy eval in `list_goals`**

In `apps/api/routes/goals.py`, add the lazy eval scan after the items are loaded. The full updated `list_goals` function:

```python
@router.get(
    "/users/{user_id}/goals",
    response_model=PaginatedGoalsResponse,
    summary="List all goals for a user",
)
async def list_goals(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    total_result = await db.execute(
        select(func.count(Goal.id)).where(Goal.user_id == user_id)
    )
    total = total_result.scalar_one()
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.user_id == user_id)
        .order_by(Goal.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = result.scalars().all()

    # Lazy eval: reset milestones stuck in "generating" for >5 minutes to "failed"
    stale_threshold = datetime.now(timezone.utc) - timedelta(minutes=5)
    for goal in items:
        for ms in goal.milestones:
            if (
                ms.sprint_status == "generating"
                and ms.generation_started_at is not None
                and ms.generation_started_at < stale_threshold
            ):
                ms.sprint_status = "failed"
    await db.flush()

    return PaginatedGoalsResponse(items=items, total=total, limit=limit, offset=offset)
```

Add the required imports to the top of `routes/goals.py` if not already present:
```python
from datetime import datetime, timedelta, timezone
```

- [ ] **Step 8: Run the lazy eval test — confirm it passes**

```bash
GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_goals.py::test_list_goals_resets_stuck_generating_milestone_to_failed -v
```

Expected: PASS.

- [ ] **Step 9: Run the full test suite**

```bash
GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/ -v
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
cd /d/PyCharm/goalforge
git add apps/api/models.py apps/api/alembic/versions/ apps/api/services/task_service.py apps/api/routes/goals.py apps/api/tests/test_goals.py
git commit -m "feat: add generation_started_at + lazy eval to rescue stuck generating milestones"
```

---

## Task 3: Two-Phase Async Goal Creation — Backend (Issue 4)

**Files:**
- Create: `apps/api/services/goal_service.py`
- Modify: `apps/api/routes/goals.py` — `create_goal` rewrite
- Modify: `apps/api/routes/milestones.py` — `retry_sprint_generation` extension
- Modify: `apps/api/tests/conftest.py` — add mock + update `create_test_goal`
- Modify: `apps/api/tests/test_goals.py` — update `test_create_goal`, add new tests
- Modify: `apps/api/tests/test_retry_generation.py` — add sentinel routing test

### Step 3a: Create `goal_service.py`

- [ ] **Step 1: Create `apps/api/services/goal_service.py`**

```python
"""Background goal generation — Phase 2 of two-phase goal creation."""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete as sql_delete, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from ai_utils import generate_smart_goal
from database import engine
from exceptions import AIGenerationError
from models import DailyTask, Goal, Milestone
from utils import user_today

logger = logging.getLogger(__name__)

# Sentinel title used on placeholder milestones created during Phase 1.
# Used by retry_sprint_generation to detect initial-creation failures.
PLACEHOLDER_MILESTONE_TITLE = "Generating your plan\u2026"


async def _generate_goal_async(
    goal_id: uuid.UUID,
    user_id: str,
    user_timezone: str,
    raw_input: str,
) -> None:
    """
    Phase 2 of two-phase goal creation.

    Called via FastAPI BackgroundTasks after create_goal returns 202.
    Opens its own AsyncSession — the request session is already closed.

    On success: updates goal fields, replaces placeholder milestone with
    real milestones + sprint-1 tasks.
    On AIGenerationError: sets the placeholder milestone sprint_status='failed'
    so the user sees the retry button.
    """
    async with AsyncSession(engine) as db:
        today = user_today(user_timezone)

        try:
            ai_output = await generate_smart_goal(raw_input, today=today)
        except AIGenerationError as exc:
            logger.error(
                "_generate_goal_async: AI failed for goal %s (user %s): %s",
                goal_id, user_id, exc,
            )
            async with db.begin():
                await db.execute(
                    sql_update(Milestone)
                    .where(Milestone.goal_id == goal_id)
                    .values(sprint_status="failed")
                )
            return

        try:
            async with db.begin():
                # Update goal with AI-generated fields
                await db.execute(
                    sql_update(Goal)
                    .where(Goal.id == goal_id)
                    .values(
                        smart_title=ai_output.smart_title,
                        smart_description=ai_output.smart_description,
                        goal_type=ai_output.goal_type,
                        target_date=ai_output.target_date,
                    )
                )

                # Delete the placeholder milestone
                await db.execute(sql_delete(Milestone).where(Milestone.goal_id == goal_id))

                # Create real milestones
                milestone_rows: list[Milestone] = []
                for i, ms_config in enumerate(ai_output.milestones):
                    ms = Milestone(
                        id=uuid.uuid4(),
                        goal_id=goal_id,
                        title=ms_config.title,
                        position=i + 1,
                        is_final=ms_config.is_final,
                        sprint_theme=ms_config.sprint_theme,
                        sprint_status="active" if i == 0 else "pending",
                    )
                    db.add(ms)
                    milestone_rows.append(ms)

                # flush to get milestone PKs before creating tasks
                await db.flush()

                # Clean up any NULL-milestone orphaned tasks (can accumulate on partial retry)
                await db.execute(
                    sql_delete(DailyTask).where(
                        DailyTask.goal_id == goal_id,
                        DailyTask.milestone_id == None,  # noqa: E711
                    )
                )

                first_milestone = milestone_rows[0]
                for task_data in ai_output.initial_tasks:
                    db.add(DailyTask(
                        id=uuid.uuid4(),
                        goal_id=goal_id,
                        milestone_id=first_milestone.id,
                        description=task_data.description,
                        tip=task_data.tip,
                        assigned_date=task_data.assigned_date,
                    ))

        except Exception as exc:
            logger.error(
                "_generate_goal_async: DB write failed for goal %s: %s", goal_id, exc
            )
            try:
                async with db.begin():
                    await db.execute(
                        sql_update(Milestone)
                        .where(Milestone.goal_id == goal_id)
                        .values(sprint_status="failed")
                    )
            except Exception as inner:
                logger.error(
                    "_generate_goal_async: could not set failed status for goal %s: %s",
                    goal_id, inner,
                )
```

### Step 3b: Rewrite `create_goal` in `routes/goals.py`

- [ ] **Step 2: Write failing test for two-phase creation**

Add to `apps/api/tests/test_goals.py`:

```python
async def test_create_goal_returns_202_with_placeholder(client):
    """
    Phase 1: POST returns 202 immediately with placeholder milestone.
    Background task populates real data (mocked in conftest).
    """
    resp = await client.post(
        f"/users/{TEST_USER_ID}/goals",
        json={"raw_input": "I want to run a 5K race in under 25 minutes within 3 months"},
    )
    # After this await, BackgroundTasks have already executed (ASGI test mode)
    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "active"
    assert data["user_id"] == TEST_USER_ID
    # raw_input used as placeholder smart_title
    assert data["smart_title"] == "I want to run a 5K race in under 25 minutes within 3 months"
```

- [ ] **Step 3: Run — confirm it fails (currently returns 201)**

```bash
GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_goals.py::test_create_goal_returns_202_with_placeholder -v
```

Expected: FAIL (AssertionError: 201 != 202).

- [ ] **Step 4: Rewrite `create_goal` in `routes/goals.py`**

Replace the existing `create_goal` function with:

```python
@router.post(
    "/users/{user_id}/goals",
    response_model=GoalResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create a SMART goal from raw user input (two-phase: returns immediately)",
)
@rate_limit("5/minute", key_func=_user_key)
async def create_goal(
    request: Request,
    user_id: str,
    payload: GoalCreate,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    current_user_email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    user = await get_or_create_user(user_id, current_user_email, db)
    user_timezone = user.timezone  # capture before session closes

    today = user_today(user_timezone)

    # Phase 1: save placeholder goal + milestone immediately
    goal = Goal(
        id=uuid.uuid4(),
        user_id=user.id,
        raw_input=payload.raw_input,
        smart_title=payload.raw_input,          # placeholder — overwritten in Phase 2
        smart_description="",                    # placeholder
        goal_type="personal",                    # placeholder
        target_date=today + timedelta(days=35),  # placeholder (5 sprints × 7 days)
        status="active",
    )
    db.add(goal)
    await db.flush()

    placeholder_ms = Milestone(
        id=uuid.uuid4(),
        goal_id=goal.id,
        title=PLACEHOLDER_MILESTONE_TITLE,
        position=1,
        is_final=False,
        sprint_theme="",
        sprint_status="generating",
        generation_started_at=datetime.now(timezone.utc),
    )
    db.add(placeholder_ms)
    await db.flush()

    # Phase 2: enqueue AI generation as a background task
    background_tasks.add_task(
        _generate_goal_async,
        goal_id=goal.id,
        user_id=user.id,
        user_timezone=user_timezone,
        raw_input=payload.raw_input,
    )

    # Return the placeholder goal (milestones eagerly loaded)
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal.id)
    )
    return result.scalar_one()
```

Add required imports at the top of `routes/goals.py`:

```python
from datetime import datetime, timedelta, timezone   # add timezone if not present
from fastapi import BackgroundTasks                   # add to existing fastapi import
from services.goal_service import _generate_goal_async, PLACEHOLDER_MILESTONE_TITLE
```

Remove the import of `generate_smart_goal` and `AIGenerationError` from `routes/goals.py` (no longer used there) unless they are used elsewhere in the file.

- [ ] **Step 5: Update `conftest.py` to mock `_generate_goal_async` with a DB side-effect**

The mock must actually populate the goal with mock AI data (using the test `session_factory`) because `BackgroundTasks` run synchronously in ASGI test mode and other tests depend on fully-populated goals.

In `apps/api/tests/conftest.py`, update the `client` and `other_client` fixtures:

1. Add imports at the top:
```python
from sqlalchemy import delete as sql_delete, update as sql_update
from models import DailyTask, Goal, Milestone
from services.goal_service import PLACEHOLDER_MILESTONE_TITLE
```

2. Inside the `client` fixture, before the `with (patch(...))` block, create the mock side-effect:

```python
    async def _mock_generate_goal_async(goal_id, user_id, user_timezone, raw_input):
        """Populate goal with mock AI data using the test session_factory."""
        async with session_factory() as session:
            await session.execute(
                sql_update(Goal).where(Goal.id == goal_id).values(
                    smart_title=mock_goal.smart_title,
                    smart_description=mock_goal.smart_description,
                    goal_type=mock_goal.goal_type,
                    target_date=mock_goal.target_date,
                )
            )
            await session.execute(sql_delete(Milestone).where(Milestone.goal_id == goal_id))
            milestone_rows = []
            for i, ms_config in enumerate(mock_goal.milestones):
                ms = Milestone(
                    id=uuid.uuid4(),
                    goal_id=goal_id,
                    title=ms_config.title,
                    position=i + 1,
                    is_final=ms_config.is_final,
                    sprint_theme=ms_config.sprint_theme,
                    sprint_status="active" if i == 0 else "pending",
                )
                session.add(ms)
                milestone_rows.append(ms)
            await session.flush()
            first_ms = milestone_rows[0]
            for task_data in mock_goal.initial_tasks:
                session.add(DailyTask(
                    id=uuid.uuid4(),
                    goal_id=goal_id,
                    milestone_id=first_ms.id,
                    description=task_data.description,
                    tip=task_data.tip,
                    assigned_date=task_data.assigned_date,
                ))
            await session.commit()
```

3. Add `uuid` import at the top of conftest (it's likely already there; verify).

4. Add the new patch to the `with (patch(...))` block:
```python
        patch("routes.goals._generate_goal_async", new=_mock_generate_goal_async),
```

5. In the `other_client` fixture, define the same mock inline using `other_client`'s `session_factory` (a separate variable — do NOT reuse `client`'s `session_factory`). Place the full function body inside `other_client`:

```python
    async def _mock_generate_goal_async(goal_id, user_id, user_timezone, raw_input):
        async with session_factory() as session:
            await session.execute(
                sql_update(Goal).where(Goal.id == goal_id).values(
                    smart_title=mock_goal.smart_title,
                    smart_description=mock_goal.smart_description,
                    goal_type=mock_goal.goal_type,
                    target_date=mock_goal.target_date,
                )
            )
            await session.execute(sql_delete(Milestone).where(Milestone.goal_id == goal_id))
            milestone_rows = []
            for i, ms_config in enumerate(mock_goal.milestones):
                ms = Milestone(
                    id=uuid.uuid4(),
                    goal_id=goal_id,
                    title=ms_config.title,
                    position=i + 1,
                    is_final=ms_config.is_final,
                    sprint_theme=ms_config.sprint_theme,
                    sprint_status="active" if i == 0 else "pending",
                )
                session.add(ms)
                milestone_rows.append(ms)
            await session.flush()
            first_ms = milestone_rows[0]
            for task_data in mock_goal.initial_tasks:
                session.add(DailyTask(
                    id=uuid.uuid4(),
                    goal_id=goal_id,
                    milestone_id=first_ms.id,
                    description=task_data.description,
                    tip=task_data.tip,
                    assigned_date=task_data.assigned_date,
                ))
            await session.commit()
```

Then add to `other_client`'s `with (patch(...))` block:
```python
        patch("routes.goals._generate_goal_async", new=_mock_generate_goal_async),
```

6. Update `create_test_goal` to expect 202 and re-fetch:
```python
async def create_test_goal(client: AsyncClient) -> dict:
    resp = await client.post(
        f"/users/{TEST_USER_ID}/goals",
        json={"raw_input": "I want to run a 5K race in under 25 minutes within 3 months"},
    )
    # BackgroundTasks run synchronously in ASGI test mode — goal is fully populated by now
    assert resp.status_code == 202
    goal_id = resp.json()["id"]
    get_resp = await client.get(f"/goals/{goal_id}")
    assert get_resp.status_code == 200
    return get_resp.json()
```

- [ ] **Step 6: Update `test_create_goal` in `test_goals.py`**

The test currently asserts 201 and expects real AI data in the direct POST response. Update:

```python
async def test_create_goal(client):
    """POST returns 202 with placeholder; background task populates real data."""
    resp = await client.post(
        f"/users/{TEST_USER_ID}/goals",
        json={"raw_input": "I want to run a 5K race in under 25 minutes within 3 months"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "active"
    assert data["user_id"] == TEST_USER_ID
    # Phase 1 placeholder values
    assert data["smart_title"] == "I want to run a 5K race in under 25 minutes within 3 months"
    assert len(data["milestones"]) == 1
    assert data["milestones"][0]["sprint_status"] == "generating"

    # After BackgroundTasks run, GET returns the fully-populated goal
    goal_id = data["id"]
    get_resp = await client.get(f"/goals/{goal_id}")
    assert get_resp.status_code == 200
    full_data = get_resp.json()
    assert full_data["smart_title"] == "Run 5K in under 25 minutes"
    assert len(full_data["milestones"]) == 3
    assert len(full_data["daily_tasks"]) == 7
```

### Step 3c: Extend `retry_sprint_generation` for initial creation failures

- [ ] **Step 7: Write failing test for sentinel routing**

Add to `apps/api/tests/test_retry_generation.py`:

```python
async def test_retry_generation_routes_initial_creation_failure_to_goal_async(client, engine):
    """
    When the failed milestone has the sentinel title (PLACEHOLDER_MILESTONE_TITLE),
    retry-generation must call _generate_goal_async — NOT generate_sprint_tasks.
    """
    from unittest.mock import AsyncMock, patch, call
    from datetime import datetime, timezone
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
    from sqlalchemy import update as sql_update
    from models import Milestone
    from services.goal_service import PLACEHOLDER_MILESTONE_TITLE

    # POST to create a goal — BackgroundTasks run and populate real data via mock
    resp = await client.post(
        f"/users/{TEST_USER_ID}/goals",
        json={"raw_input": "Learn guitar in 3 months"},
    )
    assert resp.status_code == 202
    goal_id = resp.json()["id"]
    # The placeholder milestone ID (before BackgroundTasks replaced it)
    # After BackgroundTasks, real milestones exist. We need to force a milestone
    # back to sentinel/failed state for the retry routing test.

    # Get current milestones after background population
    get_resp = await client.get(f"/goals/{goal_id}")
    milestones = sorted(get_resp.json()["milestones"], key=lambda m: m["position"])
    first_ms_id = milestones[0]["id"]

    # Force milestone back to sentinel title + failed status in the test DB
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        await session.execute(
            sql_update(Milestone)
            .where(Milestone.id == first_ms_id)
            .values(title=PLACEHOLDER_MILESTONE_TITLE, sprint_status="failed")
        )
        await session.commit()

    # Patch both possible callees to track which one is invoked
    with patch("routes.milestones._generate_goal_async", new=AsyncMock()) as mock_gen_goal, \
         patch("routes.milestones.generate_sprint_tasks", new=AsyncMock()) as mock_gen_sprint:

        retry_resp = await client.post(
            f"/goals/{goal_id}/milestones/{first_ms_id}/retry-generation"
        )
        assert retry_resp.status_code == 200

    # Sentinel branch must route to _generate_goal_async only
    mock_gen_goal.assert_called_once()
    mock_gen_sprint.assert_not_called()
```

- [ ] **Step 8: Extend `retry_sprint_generation` in `routes/milestones.py`**

Add `BackgroundTasks` import and the sentinel branch. The full updated function signature and routing logic:

1. Add to imports at top of `routes/milestones.py`:
```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from services.goal_service import _generate_goal_async, PLACEHOLDER_MILESTONE_TITLE
```

2. Update the function signature (add `background_tasks: BackgroundTasks`):
```python
async def retry_sprint_generation(
    request: Request,
    goal_id: uuid.UUID,
    milestone_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
```

3. After the `today = user_today(...)` line (around line 148), add the sentinel branch **before** the `goal_context = ...` line:

```python
    # Sentinel check: if this is a failed initial goal creation (not a sprint pre-gen failure),
    # route to full goal generation instead of sprint task generation.
    if milestone.title == PLACEHOLDER_MILESTONE_TITLE:
        milestone.sprint_status = "generating"
        milestone.generation_started_at = datetime.now(timezone.utc)
        await db.flush()
        background_tasks.add_task(
            _generate_goal_async,
            goal_id=goal_obj.id,
            user_id=user_obj.id if user_obj else current_user_id,
            user_timezone=user_obj.timezone if user_obj else "UTC",
            raw_input=goal_obj.raw_input,
        )
        result = await db.execute(
            select(Goal)
            .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
            .where(Goal.id == goal_id)
        )
        return result.scalar_one()
```

Add `datetime` and `timezone` imports to `milestones.py` if not present (they are already imported based on the file read).

- [ ] **Step 9: Run full test suite**

```bash
GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/ -v
```

Expected: all pass. Fix any failures from the conftest mock changes before proceeding.

- [ ] **Step 10: TypeScript check (frontend not changed yet but ensure backend changes don't break build)**

```bash
cd /d/PyCharm/goalforge/apps/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
cd /d/PyCharm/goalforge
git add apps/api/services/goal_service.py apps/api/routes/goals.py apps/api/routes/milestones.py apps/api/tests/conftest.py apps/api/tests/test_goals.py apps/api/tests/test_retry_generation.py
git commit -m "feat: two-phase async goal creation via FastAPI BackgroundTasks"
```

---

## Task 4: Two-Phase Goal Creation — Frontend Loading State (Issue 4)

**Files:**
- Modify: `apps/web/src/components/GoalCard.tsx`

The loading predicate throughout is: `goal.milestones[0]?.sprint_status === 'generating'`.

- [ ] **Step 1: Verify `useGoals.ts` polling already covers generating state**

Read `apps/web/src/hooks/useGoals.ts`. The `needsPolling` function (line 10) already checks `m.sprint_status === 'generating'`. No changes needed there — the 5-second polling is already wired.

- [ ] **Step 2: Add loading skeleton to `GoalCard.tsx`**

Read `GoalCard.tsx` fully first. After the existing computed-values block (around line 80), add:

```tsx
  // Two-phase goal creation: show skeleton while AI generates the plan
  const isGenerating = goal.milestones.length > 0 && goal.milestones[0].sprint_status === 'generating'

  if (isGenerating) {
    return (
      <div
        style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}
        className="w-full"
      >
        {/* Title placeholder — show user's raw_input (stored as smart_title in Phase 1) */}
        <div style={{ fontFamily: T.serif, color: T.text, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          {goal.smart_title}
        </div>
        {/* No goal_type badge — placeholder value "personal" before AI classifies */}
        <div style={{ color: T.textDim, fontSize: 13 }}>
          Generating your plan… this takes a few seconds.
        </div>
        <div
          style={{
            marginTop: 16,
            height: 8,
            borderRadius: 4,
            background: T.border,
            overflow: 'hidden',
          }}
        >
          <div
            className="animate-pulse"
            style={{ height: '100%', width: '60%', background: T.indigo, borderRadius: 4 }}
          />
        </div>
      </div>
    )
  }
```

Place this block **before** the main `return (` of the component.

**Note on `T` tokens:** Import `T` from `'../lib/theme'` (already imported). The skeleton above uses `T.surface`, `T.border`, `T.text`, `T.textDim`, and `T.indigo` — all valid tokens in `theme.ts`. Do not use `T.textPrimary`, `T.textMuted`, or `T.accent` — these do not exist.

- [ ] **Step 3: TypeScript check**

```bash
cd /d/PyCharm/goalforge/apps/web
npx tsc --noEmit
```

Expected: no errors. Fix any type errors (e.g., `Milestone` type missing `generation_started_at` — if so, add `generation_started_at?: string | null` to the `Milestone` interface in `src/lib/types.ts`).

- [ ] **Step 4: Check `Milestone` type in `src/lib/types.ts`**

Read `apps/web/src/lib/types.ts`. Verify `Milestone` interface includes `generation_started_at`. If not, add:
```typescript
  generation_started_at?: string | null
```

- [ ] **Step 5: TypeScript check again**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /d/PyCharm/goalforge
git add apps/web/src/components/GoalCard.tsx apps/web/src/lib/types.ts
git commit -m "feat: GoalCard loading skeleton for two-phase goal creation"
```

---

## Final Verification

- [ ] **Run complete backend test suite**

```bash
cd /d/PyCharm/goalforge/apps/api
GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/ -v
```

Expected: all pass.

- [ ] **Run frontend type check**

```bash
cd /d/PyCharm/goalforge/apps/web
npm run build
```

Expected: TypeScript check + Vite build both succeed.

- [ ] **Verify Alembic migration chain is intact**

```bash
cd /d/PyCharm/goalforge/apps/api
py -3 -m alembic history
```

Expected: new migration appears at the head with no gaps in the chain.

---

## Summary of Changes

| Issue | Fix | Files |
|---|---|---|
| 1 — Task race condition | `.with_for_update()` on task SELECT | `routes/tasks.py` |
| 2 — Goal race condition | `.with_for_update()` on goal SELECT | `routes/goals.py` |
| 3 — Stuck generating milestone | `generation_started_at` + lazy eval in `list_goals` | `models.py`, migration, `task_service.py`, `routes/goals.py` |
| 4 — Blocking AI on create | Two-phase: placeholder + BackgroundTasks | `services/goal_service.py`, `routes/goals.py`, `routes/milestones.py`, `GoalCard.tsx` |
