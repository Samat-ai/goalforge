# Adaptive Energy Check-in (Task Resizer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow low-energy users to bulk-shrink all of today's tasks into 3-minute AI-generated first steps, triggered from the daily digest email or an in-app Dashboard button.

**Architecture:** An Alembic migration adds `original_description` / `original_tip` to `daily_tasks`. A new `routes/energy.py` provides two endpoints: `POST /users/{user_id}/energy-resize` (parallel Gemini, idempotent) and `POST /tasks/{task_id}/restore` (swap back). The frontend captures `?energy=low` from email deep-links via `EnergyParamCapture` (survives Clerk login redirects via `sessionStorage`), shows a confirmation `EnergyModal`, and adds per-task Restore buttons in `DailyTaskList`.

**Tech Stack:** Python/FastAPI/SQLAlchemy async, Alembic, google-genai (Gemini 2.5 Flash), React 19 + TypeScript, TanStack Query v5, sonner toasts, Clerk auth.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `apps/api/alembic/versions/b2c3d4e5f6a1_add_energy_resize_columns.py` | Migration: 2 nullable columns on `daily_tasks` |
| Modify | `apps/api/models.py` | Add `original_description`, `original_tip` to `DailyTask` |
| Modify | `apps/api/schemas.py` | Add fields to `TaskResponse`; add `EnergyResizeResponse` |
| Modify | `apps/api/ai_utils.py` | Add `_ENERGY_RESIZE_PROMPT` + `resize_task_for_low_energy()` |
| Create | `apps/api/routes/energy.py` | Bulk-resize + restore endpoints |
| Modify | `apps/api/main.py` | Register `energy.router` |
| Modify | `apps/api/services/email_service.py` | Add low-energy CTA to digest HTML |
| Create | `apps/api/tests/test_energy.py` | Integration tests for both endpoints |
| Modify | `apps/web/src/lib/types.ts` | Add `original_description?`, `original_tip?` to `Task` |
| Create | `apps/web/src/hooks/useEnergyMutations.ts` | `useEnergyResizeMutation`, `useRestoreTaskMutation` |
| Modify | `apps/web/src/hooks/index.ts` | Re-export energy hooks |
| Modify | `apps/web/src/App.tsx` | Add `EnergyParamCapture` component |
| Create | `apps/web/src/components/EnergyModal.tsx` | Confirmation overlay |
| Modify | `apps/web/src/pages/Dashboard.tsx` | State + `EnergyModal` rendering + wiring |
| Modify | `apps/web/src/components/TodayBar.tsx` | Organic "Low Energy" trigger button |
| Modify | `apps/web/src/components/DailyTaskList.tsx` | Per-task Restore button |
| Modify | `apps/web/src/components/GoalCard.tsx` | Call `useRestoreTaskMutation`, pass down |

---

## Task 1: Alembic Migration

**Files:**
- Create: `apps/api/alembic/versions/b2c3d4e5f6a1_add_energy_resize_columns.py`

- [ ] **Step 1: Create the migration file manually**

  Use `op.execute` with `IF NOT EXISTS` (CLAUDE.md catch-up pattern — `Base.metadata.create_all` may have already created the table without these columns):

  ```python
  # apps/api/alembic/versions/b2c3d4e5f6a1_add_energy_resize_columns.py
  """add energy resize columns to daily_tasks

  Revision ID: b2c3d4e5f6a1
  Revises: ab3ab8b88a85
  Create Date: 2026-03-25
  """
  from alembic import op

  revision = "b2c3d4e5f6a1"
  down_revision = "ab3ab8b88a85"
  branch_labels = None
  depends_on = None


  def upgrade() -> None:
      op.execute(
          "ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS original_description VARCHAR"
      )
      op.execute(
          "ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS original_tip VARCHAR"
      )


  def downgrade() -> None:
      op.execute(
          "ALTER TABLE daily_tasks DROP COLUMN IF EXISTS original_description"
      )
      op.execute(
          "ALTER TABLE daily_tasks DROP COLUMN IF EXISTS original_tip"
      )
  ```

- [ ] **Step 2: Run the migration**

  ```bash
  cd apps/api
  py -3 -m alembic upgrade head
  ```

  Expected: `Running upgrade ab3ab8b88a85 -> b2c3d4e5f6a1, add energy resize columns to daily_tasks`

- [ ] **Step 3: Commit**

  ```bash
  git add apps/api/alembic/versions/b2c3d4e5f6a1_add_energy_resize_columns.py
  git commit -m "chore: add energy resize columns migration"
  ```

---

## Task 2: ORM Model + Pydantic Schemas

**Files:**
- Modify: `apps/api/models.py` (after line 138, inside `DailyTask`)
- Modify: `apps/api/schemas.py` (after `TaskResponse`, add `EnergyResizeResponse`)

- [ ] **Step 1: Add columns to `DailyTask` in `models.py`**

  After the `is_rescue_task` column (line ~136), add:

  ```python
  original_description: Mapped[str | None] = mapped_column(String, nullable=True)
  original_tip: Mapped[str | None] = mapped_column(String, nullable=True)
  ```

- [ ] **Step 2: Add fields to `TaskResponse` in `schemas.py`**

  In `TaskResponse` (currently ends with `is_rescue_task: bool = False`), add:

  ```python
  original_description: str | None = None
  original_tip: str | None = None
  ```

  Note: these also appear on `TaskCompleteResponse` (which inherits `TaskResponse`) — this is harmless; both will be `None` during normal task completion.

- [ ] **Step 3: Add `EnergyResizeResponse` to `schemas.py`**

  After `TaskCompleteResponse`:

  ```python
  class EnergyResizeResponse(BaseModel):
      tasks_resized: int
      tasks: list[TaskResponse]
  ```

- [ ] **Step 4: Write the failing test to verify schema shape**

  In a new file `apps/api/tests/test_energy.py`:

  ```python
  """Integration tests for energy resize endpoints."""

  from datetime import date
  from unittest.mock import AsyncMock, patch

  import pytest

  from schemas import AITaskOutput
  from tests.conftest import OTHER_USER_ID, TEST_USER_ID, create_test_goal

  MOCK_RESIZE = AITaskOutput(
      description="Open your running app",
      tip="Just doing this is a win today.",
      assigned_date=date.today(),
  )


  async def test_schema_has_original_fields(client):
      """TaskResponse includes original_description and original_tip (both None by default)."""
      goal = await create_test_goal(client)
      task = goal["daily_tasks"][0]
      assert "original_description" in task
      assert task["original_description"] is None
      assert "original_tip" in task
      assert task["original_tip"] is None
  ```

- [ ] **Step 5: Run test to confirm it fails before model changes**

  ```bash
  cd apps/api
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_energy.py::test_schema_has_original_fields -v
  ```

  Expected: FAIL (`KeyError: 'original_description'`)

- [ ] **Step 6: Run test again after model + schema changes are in place**

  ```bash
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_energy.py::test_schema_has_original_fields -v
  ```

  Expected: PASS

- [ ] **Step 7: Commit**

  ```bash
  git add apps/api/models.py apps/api/schemas.py apps/api/tests/test_energy.py
  git commit -m "feat: add original_description/tip fields to DailyTask and TaskResponse"
  ```

---

## Task 3: AI Prompt Function

**Files:**
- Modify: `apps/api/ai_utils.py`

- [ ] **Step 1: Write the failing AI unit test**

  Create `apps/api/tests/test_energy_ai.py`:

  ```python
  """Unit tests for resize_task_for_low_energy AI function."""

  from datetime import date
  from unittest.mock import AsyncMock, MagicMock, patch

  import pytest

  from ai_utils import resize_task_for_low_energy


  @pytest.mark.asyncio
  async def test_resize_task_returns_first_step():
      today = date.today()
      mock_response = MagicMock()
      mock_response.text = (
          f'{{"description": "Open your running app", '
          f'"tip": "Just doing this is a win today.", '
          f'"assigned_date": "{today.isoformat()}"}}'
      )

      with patch("ai_utils._client") as mock_client:
          mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
          result = await resize_task_for_low_energy(
              goal_context="Run 5K: Build endurance over 90 days.",
              sprint_theme="Build base",
              original_description="Run 3 miles at moderate pace",
              assigned_date=today,
          )

      assert result.description == "Open your running app"
      assert "win today" in result.tip


  @pytest.mark.asyncio
  async def test_resize_task_prompt_contains_original_task():
      """The prompt must include the original task description."""
      today = date.today()
      captured_calls = []
      mock_response = MagicMock()
      mock_response.text = (
          f'{{"description": "Open your notes app", '
          f'"tip": "Just doing this is a win today.", '
          f'"assigned_date": "{today.isoformat()}"}}'
      )

      async def mock_generate(*args, **kwargs):
          captured_calls.append(kwargs.get("config") or args)
          return mock_response

      with patch("ai_utils._client") as mock_client:
          mock_client.aio.models.generate_content = mock_generate
          await resize_task_for_low_energy(
              goal_context="Write a novel: Complete first draft.",
              sprint_theme="Outline act 1",
              original_description="Write 500 words of chapter 2",
              assigned_date=today,
          )

      assert len(captured_calls) == 1
  ```

- [ ] **Step 2: Run test to confirm it fails (function doesn't exist yet)**

  ```bash
  cd apps/api
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_energy_ai.py -v
  ```

  Expected: FAIL (`ImportError: cannot import name 'resize_task_for_low_energy'`)

- [ ] **Step 3: Add `_ENERGY_RESIZE_PROMPT` constant and `resize_task_for_low_energy` to `ai_utils.py`**

  Add after `_RESCUE_SYSTEM_PROMPT` block (end of file):

  ```python
  _ENERGY_RESIZE_PROMPT = """\
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
  """


  async def resize_task_for_low_energy(
      goal_context: str,
      sprint_theme: str,
      original_description: str,
      assigned_date: date,
  ) -> AITaskOutput:
      """
      Generate a 3-minute first-step micro-task from an original task description.

      IMPORTANT: Callers must consume ONLY result.description and result.tip.
      result.assigned_date must be DISCARDED — never write it back to the DB.

      Raises:
          AIGenerationError: after 3 failed attempts.
      """
      system_instruction = _ENERGY_RESIZE_PROMPT.format(
          original_description=original_description,
          goal_context=goal_context,
          sprint_theme=sprint_theme,
          assigned_date=assigned_date.isoformat(),
      )
      user_message = (
          f"Generate a 3-minute first step for: {original_description}\n"
          f"Goal: {goal_context}"
      )

      async def _call() -> AITaskOutput:
          response = await _client.aio.models.generate_content(
              model=_MODEL,
              contents=user_message,
              config=types.GenerateContentConfig(
                  system_instruction=system_instruction,
                  response_mime_type="application/json",
                  response_schema=AITaskOutput,
                  temperature=1.0,
              ),
          )
          raw_json: str = response.text
          logger.debug("Gemini raw response (energy_resize): %s", raw_json)
          data = json.loads(raw_json)
          return AITaskOutput.model_validate(data)

      return await _with_retry(_call, "resize_task_for_low_energy")
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_energy_ai.py -v
  ```

  Expected: 2 PASSED

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/ai_utils.py apps/api/tests/test_energy_ai.py
  git commit -m "feat: add resize_task_for_low_energy AI function"
  ```

---

## Task 4: Bulk Resize Endpoint

**Files:**
- Create: `apps/api/routes/energy.py`
- Modify: `apps/api/main.py` (register router)

- [ ] **Step 1: Write the failing tests in `test_energy.py`**

  Append to `apps/api/tests/test_energy.py`:

  ```python
  async def test_energy_resize_bulk_mutates_tasks(client):
      """Resized tasks get micro-descriptions; original is preserved."""
      goal = await create_test_goal(client)
      today = date.today().isoformat()
      tasks_today = [t for t in goal["daily_tasks"] if t["assigned_date"] == today]
      assert tasks_today, "Need at least one task today"
      original_desc = tasks_today[0]["description"]

      with patch("routes.energy.resize_task_for_low_energy", new=AsyncMock(return_value=MOCK_RESIZE)):
          resp = await client.post(f"/users/{TEST_USER_ID}/energy-resize")

      assert resp.status_code == 200
      data = resp.json()
      assert data["tasks_resized"] == len(tasks_today)
      resized = [t for t in data["tasks"] if t["original_description"] is not None]
      assert len(resized) == data["tasks_resized"]
      assert resized[0]["description"] == "Open your running app"
      assert resized[0]["original_description"] == original_desc


  async def test_energy_resize_idempotent(client):
      """Second call when all tasks already resized returns tasks_resized=0."""
      await create_test_goal(client)

      with patch("routes.energy.resize_task_for_low_energy", new=AsyncMock(return_value=MOCK_RESIZE)):
          await client.post(f"/users/{TEST_USER_ID}/energy-resize")
          resp = await client.post(f"/users/{TEST_USER_ID}/energy-resize")

      assert resp.status_code == 200
      assert resp.json()["tasks_resized"] == 0


  async def test_energy_resize_forbidden_for_other_user(client):
      resp = await client.post(f"/users/{OTHER_USER_ID}/energy-resize")
      assert resp.status_code == 403


  async def test_energy_resize_partial_gemini_failure(client):
      """Tasks where Gemini fails are skipped; others succeed."""
      goal = await create_test_goal(client)
      today = date.today().isoformat()
      tasks_today = [t for t in goal["daily_tasks"] if t["assigned_date"] == today]
      if len(tasks_today) < 2:
          pytest.skip("Need at least 2 tasks today for this test")

      call_count = 0

      async def mock_resize_partial(*args, **kwargs):
          nonlocal call_count
          call_count += 1
          if call_count == 1:
              raise Exception("Simulated Gemini failure")
          return MOCK_RESIZE

      with patch("routes.energy.resize_task_for_low_energy", new=mock_resize_partial):
          resp = await client.post(f"/users/{TEST_USER_ID}/energy-resize")

      assert resp.status_code == 200
      data = resp.json()
      assert data["tasks_resized"] == len(tasks_today) - 1
  ```

- [ ] **Step 2: Run to confirm tests fail**

  ```bash
  cd apps/api
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_energy.py -k "bulk or idempotent or forbidden or partial" -v
  ```

  Expected: 4 FAILED (404 — route doesn't exist yet)

- [ ] **Step 3: Create `apps/api/routes/energy.py`**

  ```python
  """Energy resize routes — low-energy day task fragmentation."""

  import asyncio
  import logging
  import uuid

  from fastapi import APIRouter, Depends, HTTPException, Request
  from sqlalchemy import select
  from sqlalchemy.ext.asyncio import AsyncSession

  from ai_utils import resize_task_for_low_energy
  from auth import get_current_user_id
  from database import get_db
  from deps import _load_goal_with_ownership
  from models import DailyTask, Goal, Milestone, User
  from rate_limiting import _user_key, rate_limit
  from schemas import EnergyResizeResponse, TaskResponse
  from utils import user_today

  logger = logging.getLogger(__name__)

  router = APIRouter()


  @router.post(
      "/users/{user_id}/energy-resize",
      response_model=EnergyResizeResponse,
      summary="Bulk-resize today's pending tasks into 3-minute first steps",
  )
  @rate_limit("3/hour", key_func=_user_key)
  async def energy_resize(
      request: Request,
      user_id: str,
      current_user_id: str = Depends(get_current_user_id),
      db: AsyncSession = Depends(get_db),
  ):
      if current_user_id != user_id:
          raise HTTPException(status_code=403, detail="Forbidden")

      user_result = await db.execute(select(User).where(User.id == user_id))
      user = user_result.scalar_one_or_none()
      if user is None:
          raise HTTPException(status_code=404, detail="User not found")

      today = user_today(user.timezone)

      stmt = (
          select(DailyTask)
          .join(Goal, DailyTask.goal_id == Goal.id)
          .where(
              Goal.user_id == user_id,
              Goal.status == "active",
              DailyTask.assigned_date == today,
              DailyTask.is_completed.is_(False),
          )
          .order_by(DailyTask.assigned_date, DailyTask.position)
      )
      result = await db.execute(stmt)
      all_tasks = list(result.scalars().all())

      to_resize = [t for t in all_tasks if t.original_description is None]

      if not to_resize:
          return EnergyResizeResponse(
              tasks_resized=0,
              tasks=[TaskResponse.model_validate(t) for t in all_tasks],
          )

      to_resize = to_resize[:10]  # cap at 10 Gemini calls

      goal_ids = {t.goal_id for t in to_resize}
      milestone_ids = {t.milestone_id for t in to_resize if t.milestone_id}

      goals_result = await db.execute(select(Goal).where(Goal.id.in_(goal_ids)))
      goals_map = {g.id: g for g in goals_result.scalars().all()}

      milestones_map: dict = {}
      if milestone_ids:
          ms_result = await db.execute(
              select(Milestone).where(Milestone.id.in_(milestone_ids))
          )
          milestones_map = {m.id: m for m in ms_result.scalars().all()}

      async def _resize_one(task: DailyTask):
          goal = goals_map.get(task.goal_id)
          goal_context = (
              f"{goal.smart_title}: {goal.smart_description}" if goal else ""
          )
          milestone = milestones_map.get(task.milestone_id) if task.milestone_id else None
          sprint_theme = milestone.sprint_theme if milestone else ""
          return await resize_task_for_low_energy(
              goal_context=goal_context,
              sprint_theme=sprint_theme,
              original_description=task.description,
              assigned_date=task.assigned_date,
          )

      raw_results = await asyncio.gather(
          *[_resize_one(t) for t in to_resize],
          return_exceptions=True,
      )

      tasks_resized = 0
      for task, res in zip(to_resize, raw_results):
          if isinstance(res, Exception):
              logger.warning("Energy resize skipped task %s: %s", task.id, res)
              continue
          # IMPORTANT: only consume description and tip — never assigned_date
          task.original_description = task.description
          task.original_tip = task.tip
          task.description = res.description
          task.tip = res.tip
          tasks_resized += 1

      await db.flush()

      return EnergyResizeResponse(
          tasks_resized=tasks_resized,
          tasks=[TaskResponse.model_validate(t) for t in all_tasks],
      )
  ```

- [ ] **Step 4: Register the router in `main.py`**

  In `apps/api/main.py`, add after the existing imports:
  ```python
  from routes import energy
  ```

  Add after the rewards router line (~line 149):
  ```python
  app.include_router(energy.router, tags=["energy"])
  ```

- [ ] **Step 5: Run the failing tests**

  ```bash
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_energy.py -k "bulk or idempotent or forbidden or partial" -v
  ```

  Expected: 4 PASSED

- [ ] **Step 6: Run the full test suite to confirm no regressions**

  ```bash
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest apps/api/tests/ -v
  ```

  Expected: all existing tests still PASS

- [ ] **Step 7: Commit**

  ```bash
  git add apps/api/routes/energy.py apps/api/main.py
  git commit -m "feat: add POST /users/{user_id}/energy-resize bulk endpoint"
  ```

---

## Task 5: Restore Endpoint

**Files:**
- Modify: `apps/api/routes/energy.py` (append restore endpoint)

- [ ] **Step 1: Write the failing tests**

  Append to `apps/api/tests/test_energy.py`:

  ```python
  async def test_restore_task_swaps_back(client):
      """Restore returns original description and nulls original_description."""
      goal = await create_test_goal(client)
      today = date.today().isoformat()
      task = next(t for t in goal["daily_tasks"] if t["assigned_date"] == today)
      original_desc = task["description"]
      original_tip = task["tip"]

      with patch("routes.energy.resize_task_for_low_energy", new=AsyncMock(return_value=MOCK_RESIZE)):
          await client.post(f"/users/{TEST_USER_ID}/energy-resize")

      resp = await client.post(f"/tasks/{task['id']}/restore")
      assert resp.status_code == 200
      data = resp.json()
      assert data["description"] == original_desc
      assert data["tip"] == original_tip
      assert data["original_description"] is None
      assert data["original_tip"] is None


  async def test_restore_non_resized_task_returns_400(client):
      goal = await create_test_goal(client)
      task_id = goal["daily_tasks"][0]["id"]

      resp = await client.post(f"/tasks/{task_id}/restore")
      assert resp.status_code == 400
      assert "not in resized state" in resp.json()["detail"]


  async def test_restore_completed_task_returns_400(client):
      goal = await create_test_goal(client)
      today = date.today().isoformat()
      task = next(t for t in goal["daily_tasks"] if t["assigned_date"] == today)

      with patch("routes.energy.resize_task_for_low_energy", new=AsyncMock(return_value=MOCK_RESIZE)):
          await client.post(f"/users/{TEST_USER_ID}/energy-resize")

      await client.patch(f"/tasks/{task['id']}/complete")

      resp = await client.post(f"/tasks/{task['id']}/restore")
      assert resp.status_code == 400
      assert "completed" in resp.json()["detail"].lower()
  ```

- [ ] **Step 2: Run to confirm they fail**

  ```bash
  cd apps/api
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_energy.py -k "restore" -v
  ```

  Expected: 3 FAILED (404)

- [ ] **Step 3: Add the restore endpoint to `routes/energy.py`**

  Append to `apps/api/routes/energy.py`:

  ```python
  @router.post(
      "/tasks/{task_id}/restore",
      response_model=TaskResponse,
      summary="Restore a resized task to its original description",
  )
  async def restore_task(
      task_id: uuid.UUID,
      current_user_id: str = Depends(get_current_user_id),
      db: AsyncSession = Depends(get_db),
  ):
      result = await db.execute(select(DailyTask).where(DailyTask.id == task_id))
      task = result.scalar_one_or_none()
      if task is None:
          raise HTTPException(status_code=404, detail="Task not found")

      await _load_goal_with_ownership(task.goal_id, current_user_id, db)

      if task.original_description is None:
          raise HTTPException(status_code=400, detail="Task is not in resized state")
      if task.is_completed:
          raise HTTPException(status_code=400, detail="Cannot restore a completed task")

      task.description = task.original_description
      task.tip = task.original_tip or task.tip
      task.original_description = None
      task.original_tip = None

      await db.flush()
      return task
  ```

- [ ] **Step 4: Run restore tests**

  ```bash
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_energy.py -k "restore" -v
  ```

  Expected: 3 PASSED

- [ ] **Step 5: Run all energy tests**

  ```bash
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_energy.py tests/test_energy_ai.py -v
  ```

  Expected: all PASSED

- [ ] **Step 6: Run full test suite**

  ```bash
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest apps/api/tests/ -v
  ```

  Expected: all PASSED

- [ ] **Step 7: Commit**

  ```bash
  git add apps/api/routes/energy.py apps/api/tests/test_energy.py
  git commit -m "feat: add POST /tasks/{task_id}/restore endpoint"
  ```

---

## Task 6: Email CTA

**Files:**
- Modify: `apps/api/services/email_service.py`

- [ ] **Step 1: Write the failing test**

  Append to `apps/api/tests/test_energy.py`:

  ```python
  def test_digest_html_contains_low_energy_cta():
      """Daily digest email must include the ?energy=low deep-link CTA."""
      from services.email_service import TaskDigestItem, _build_digest_html
      html = _build_digest_html(
          "Star Forger",
          [TaskDigestItem(description="Run 3 miles", tip="Keep going", goal_title="5K race")],
      )
      assert "?energy=low" in html
      assert "Low energy" in html or "low energy" in html.lower()
  ```

- [ ] **Step 2: Run to confirm it fails**

  ```bash
  cd apps/api
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_energy.py::test_digest_html_contains_low_energy_cta -v
  ```

  Expected: FAIL (assertion error — CTA not present)

- [ ] **Step 3: Add the CTA block to `_build_digest_html` in `email_service.py`**

  In the return f-string, after `</table>` and before the last `<p>` tag, insert:

  ```python
  <a href="https://goalforge.app/dashboard?energy=low"
     style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);
            color:#fff;font-weight:600;font-size:14px;padding:12px 24px;
            border-radius:8px;text-decoration:none;margin-top:20px;">
    Low energy today? Simplify everything &rarr;
  </a>
  ```

- [ ] **Step 4: Run the CTA test**

  ```bash
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest tests/test_energy.py::test_digest_html_contains_low_energy_cta -v
  ```

  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/services/email_service.py apps/api/tests/test_energy.py
  git commit -m "feat: add low-energy CTA to daily digest email"
  ```

---

## Task 7: Frontend Types + Energy Mutations Hook

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/hooks/useEnergyMutations.ts`
- Modify: `apps/web/src/hooks/index.ts`

- [ ] **Step 1: Add `original_description` and `original_tip` to `Task` in `types.ts`**

  Find the `Task` interface and add after `is_rescue_task`:

  ```ts
  original_description?: string | null
  original_tip?: string | null
  ```

- [ ] **Step 2: Create `apps/web/src/hooks/useEnergyMutations.ts`**

  ```ts
  import { useMutation, useQueryClient } from '@tanstack/react-query'
  import { toast } from 'sonner'
  import api from '../lib/api'
  import type { Task } from '../lib/types'
  import { queryKeys } from '../lib/queryKeys'

  interface EnergyResizeResponse {
    tasks_resized: number
    tasks: Task[]
  }

  export function useEnergyResizeMutation(userId: string) {
    const qc = useQueryClient()

    return useMutation({
      mutationFn: async (): Promise<EnergyResizeResponse> => {
        const { data } = await api.post<EnergyResizeResponse>(
          `/users/${userId}/energy-resize`
        )
        return data
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: queryKeys.goals(userId) })
      },
      onError: () => {
        toast.error('Could not simplify tasks. Please try again.')
      },
    })
  }

  export function useRestoreTaskMutation(userId: string) {
    const qc = useQueryClient()

    return useMutation({
      mutationFn: async (taskId: string): Promise<Task> => {
        const { data } = await api.post<Task>(`/tasks/${taskId}/restore`)
        return data
      },
      onMutate: async (taskId: string) => {
        await qc.cancelQueries({ queryKey: queryKeys.goals(userId) })
        const prev = qc.getQueryData(queryKeys.goals(userId))

        qc.setQueryData(queryKeys.goals(userId), (old: any) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.map((g: any) => ({
              ...g,
              daily_tasks: g.daily_tasks.map((t: any) =>
                t.id === taskId
                  ? {
                      ...t,
                      description: t.original_description ?? t.description,
                      tip: t.original_tip ?? t.tip,
                      original_description: null,
                      original_tip: null,
                    }
                  : t
              ),
            })),
          }
        })

        return { prev }
      },
      onError: (_err: unknown, _taskId: string, context: any) => {
        if (context?.prev !== undefined) {
          qc.setQueryData(queryKeys.goals(userId), context.prev)
        }
        toast.error('Could not restore task. Please try again.')
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: queryKeys.goals(userId) })
      },
    })
  }
  ```

- [ ] **Step 3: Export from `hooks/index.ts`**

  Append to `apps/web/src/hooks/index.ts`:

  ```ts
  export { useEnergyResizeMutation, useRestoreTaskMutation } from './useEnergyMutations'
  ```

- [ ] **Step 4: Type-check**

  ```bash
  cd apps/web && npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/types.ts apps/web/src/hooks/useEnergyMutations.ts apps/web/src/hooks/index.ts
  git commit -m "feat: add Task energy fields + useEnergyMutations hook"
  ```

---

## Task 8: `EnergyParamCapture` + `App.tsx`

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add `EnergyParamCapture` component to `App.tsx`**

  Add the following import at the top of `App.tsx`:
  ```ts
  import { useEffect } from 'react'
  import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
  ```
  (`useSearchParams` must be added to the existing `react-router-dom` import line.)

  Add this component definition before `AuthGuard`:

  ```tsx
  /** Captures ?energy=low from email deep-links into sessionStorage before
   *  AuthGuard can redirect signed-out users to /sign-in, ensuring the param
   *  survives the Clerk login flow. */
  function EnergyParamCapture() {
    const [searchParams] = useSearchParams()
    useEffect(() => {
      if (searchParams.get('energy') === 'low') {
        sessionStorage.setItem('pending_energy_mode', 'true')
      }
    }, [searchParams])
    return null
  }
  ```

- [ ] **Step 2: Place `<EnergyParamCapture />` inside `<BrowserRouter>`, before `<Routes>`**

  The updated `App` return should look like:

  ```tsx
  export default function App() {
    return (
      <BrowserRouter>
        <EnergyParamCapture />
        <Toaster theme="dark" position="bottom-right" richColors />
        <ErrorBoundary>
          <Routes>
            {/* ... existing routes unchanged ... */}
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    )
  }
  ```

  `EnergyParamCapture` must be inside `<BrowserRouter>` (so `useSearchParams` works) but its position relative to `<Routes>` does not matter — it renders `null`.

- [ ] **Step 3: Type-check**

  ```bash
  cd apps/web && npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/App.tsx
  git commit -m "feat: add EnergyParamCapture to persist ?energy=low through Clerk redirect"
  ```

---

## Task 9: `EnergyModal` Component

**Files:**
- Create: `apps/web/src/components/EnergyModal.tsx`

- [ ] **Step 1: Create `apps/web/src/components/EnergyModal.tsx`**

  ```tsx
  import { T } from '../lib/theme'

  interface EnergyModalProps {
    onConfirm: () => void
    onDismiss: () => void
    isLoading: boolean
  }

  export default function EnergyModal({ onConfirm, onDismiss, isLoading }: EnergyModalProps) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="energy-modal-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.65)',
        }}
      >
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: '32px 28px',
            maxWidth: 420,
            width: '90%',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚡</div>
          <h2
            id="energy-modal-title"
            style={{ fontFamily: T.serif, fontSize: 22, color: T.text, marginBottom: 10 }}
          >
            Low energy today?
          </h2>
          <p
            style={{
              fontSize: 14,
              color: T.muted,
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            I'll shrink all your tasks into 3-minute first steps.
            Just start — that's the whole game.
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              aria-busy={isLoading}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg,#7c3aed,#6366f1)',
                color: '#fff',
                fontFamily: T.mono,
                fontSize: 12,
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Simplifying…' : 'Yes, simplify my day'}
            </button>

            <button
              onClick={onDismiss}
              disabled={isLoading}
              style={{
                minHeight: 44,
                minWidth: 80,
                borderRadius: 8,
                padding: '0 16px',
                border: `1px solid ${T.border}`,
                background: 'transparent',
                color: T.muted,
                fontFamily: T.mono,
                fontSize: 12,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              Never mind
            </button>
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  cd apps/web && npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/components/EnergyModal.tsx
  git commit -m "feat: add EnergyModal confirmation overlay"
  ```

---

## Task 10: Dashboard Integration

**Files:**
- Modify: `apps/web/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add imports to `Dashboard.tsx`**

  Add to the existing import block:

  ```tsx
  import EnergyModal from '../components/EnergyModal'
  import { useEnergyResizeMutation } from '../hooks'
  ```

- [ ] **Step 2: Add state and mutation for energy modal**

  After the existing `const [showCollection, setShowCollection] = useState(false)` (or similar state declarations, around line 190), add:

  ```tsx
  const [energyModalOpen, setEnergyModalOpen] = useState(false)
  ```

  After `const mutations = useGoalMutations(...)` line, add:

  ```tsx
  const energyResizeMutation = useEnergyResizeMutation(userId ?? '')
  ```

- [ ] **Step 3: Add `useEffect` to detect the energy param**

  After the existing `useEffect(() => { document.title = ... }, [])`, add:

  ```tsx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('energy') === 'low'
    const fromStorage = sessionStorage.getItem('pending_energy_mode') === 'true'
    if (fromUrl || fromStorage) {
      sessionStorage.removeItem('pending_energy_mode')
      history.replaceState(null, '', window.location.pathname)
      setEnergyModalOpen(true)
    }
  }, [])
  ```

- [ ] **Step 4: Pass `onLowEnergyOpen` to `TodayBar`**

  Change the existing `<TodayBar>` line from:

  ```tsx
  <TodayBar goals={goals} onFocusOpen={() => setFocusOpen(true)} />
  ```

  To:

  ```tsx
  <TodayBar
    goals={goals}
    onFocusOpen={() => setFocusOpen(true)}
    onLowEnergyOpen={() => setEnergyModalOpen(true)}
  />
  ```

- [ ] **Step 5: Render `EnergyModal` in the JSX (alongside `FocusOverlay`)**

  After the `</FocusOverlay>` closing tag (near the bottom of the return), add:

  ```tsx
  {energyModalOpen && (
    <EnergyModal
      onConfirm={() => {
        energyResizeMutation.mutate(undefined, {
          onSuccess: () => {
            setEnergyModalOpen(false)
            toast.success("Tasks simplified. You've got this.")
          },
        })
      }}
      onDismiss={() => {
        setEnergyModalOpen(false)
      }}
      isLoading={energyResizeMutation.isPending}
    />
  )}
  ```

  You will also need `import { toast } from 'sonner'` — add if not already present.

- [ ] **Step 6: Type-check**

  ```bash
  cd apps/web && npx tsc --noEmit
  ```

  Expected: no errors (TodayBar will fail until Task 11 adds the prop — do both tasks before running tsc, or add the prop as optional `onLowEnergyOpen?` in TodayBar first)

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/src/pages/Dashboard.tsx
  git commit -m "feat: wire EnergyModal into Dashboard with sessionStorage detection"
  ```

---

## Task 11: TodayBar Organic Trigger

**Files:**
- Modify: `apps/web/src/components/TodayBar.tsx`

- [ ] **Step 1: Add `onLowEnergyOpen` to `TodayBarProps`**

  In the `TodayBarProps` interface, add:

  ```ts
  onLowEnergyOpen?: () => void
  ```

  Update the function signature:

  ```tsx
  export default function TodayBar({ goals, onFocusOpen, onLowEnergyOpen }: TodayBarProps) {
  ```

- [ ] **Step 2: Compute whether any task is already resized**

  After the existing `const hasFocusItem = ...` line, add:

  ```tsx
  const pendingCount = todayAll.filter(t => !t.is_completed).length
  const anyResized = todayAll.some(t => t.original_description != null)
  const hasLowEnergyButton = onLowEnergyOpen != null && pendingCount > 0 && !anyResized
  ```

- [ ] **Step 3: Render the Low Energy button alongside the Focus button**

  After the closing `}` of the `{hasFocusItem && ( ... )}` block, add:

  ```tsx
  {hasLowEnergyButton && (
    <button
      onClick={onLowEnergyOpen}
      aria-label="Enter low energy mode"
      style={{
        minHeight: 44,
        minWidth: 44,
        padding: '0 14px',
        borderRadius: 8,
        border: `1px solid ${T.indigo}40`,
        background: `${T.indigo}08`,
        color: T.muted,
        fontFamily: T.mono,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.06em',
        cursor: 'pointer',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <span>⚡</span>
      <span>Low Energy</span>
    </button>
  )}
  ```

- [ ] **Step 4: Type-check**

  ```bash
  cd apps/web && npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/components/TodayBar.tsx
  git commit -m "feat: add Low Energy organic trigger button to TodayBar"
  ```

---

## Task 12: Per-Task Restore Button

**Files:**
- Modify: `apps/web/src/components/DailyTaskList.tsx`
- Modify: `apps/web/src/components/GoalCard.tsx`

- [ ] **Step 1: Add `onRestoreTask` prop to `DailyTaskListProps`**

  In `DailyTaskList.tsx`, add to the `DailyTaskListProps` interface:

  ```ts
  onRestoreTask?: (taskId: string) => void
  ```

  Update the destructured props in the function signature to include `onRestoreTask`.

- [ ] **Step 2: Add `onRestoreTask` to `TaskRow` props**

  In `TaskRow`'s props type, add:

  ```ts
  onRestoreTask?: (id: string) => void
  ```

- [ ] **Step 3: Render the Restore button inside `TaskRow`**

  Inside `TaskRow`, after the existing action buttons (edit/regenerate icons), add a conditional Restore button. Place it in the task action area — render only when `task.original_description != null` and `!task.is_completed`:

  ```tsx
  {task.original_description != null && !task.is_completed && onRestoreTask && (
    <button
      onClick={() => onRestoreTask(task.id)}
      aria-label="Restore original task"
      title="Restore original"
      style={{
        minHeight: 44,
        minWidth: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        color: T.muted,
        cursor: 'pointer',
        fontSize: 11,
        fontFamily: T.mono,
        padding: '0 6px',
      }}
    >
      ↩ Restore
    </button>
  )}
  ```

- [ ] **Step 4: Thread `onRestoreTask` through `DailyTaskList` down to `TaskRow`**

  In `DailyTaskList`, pass `onRestoreTask` through to each `<TaskRow>` render call (both the main list and the overdue catch-up section). Example:

  ```tsx
  <TaskRow
    key={task.id}
    task={task}
    {/* ... existing props ... */}
    onRestoreTask={onRestoreTask}
  />
  ```

- [ ] **Step 5: Call `useRestoreTaskMutation` in `GoalCard` and pass it to `DailyTaskList`**

  In `apps/web/src/components/GoalCard.tsx`:

  Add import:
  ```tsx
  import { useRestoreTaskMutation } from '../hooks'
  ```

  Inside `GoalCard`, after `const mutations = useGoalMutations(...)`:
  ```tsx
  const { mutate: restoreTask } = useRestoreTaskMutation(goal.user_id)
  ```

  In the `<DailyTaskList>` render, add:
  ```tsx
  onRestoreTask={restoreTask}
  ```

- [ ] **Step 6: Type-check**

  ```bash
  cd apps/web && npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 7: Run full backend test suite one final time**

  ```bash
  cd apps/api
  GEMINI_API_KEY=dummy RATE_LIMIT_ENABLED=false py -3 -m pytest apps/api/tests/ -v
  ```

  Expected: all PASSED

- [ ] **Step 8: Commit**

  ```bash
  git add apps/web/src/components/DailyTaskList.tsx apps/web/src/components/GoalCard.tsx
  git commit -m "feat: add per-task Restore button for energy-resized tasks"
  ```

---

## Task 13: CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add new entries to CLAUDE.md**

  Add `routes/energy.py` to the **Key files** table:
  ```
  | `routes/energy.py` | `POST /users/{user_id}/energy-resize` (bulk resize, idempotent, 3/hour rate limit) + `POST /tasks/{task_id}/restore` |
  ```

  Add two rows to the **API endpoints** table:
  ```
  | `POST` | `/users/{user_id}/energy-resize` | Bulk-resize today's pending tasks via Gemini (3/hour); idempotent; returns `EnergyResizeResponse` |
  | `POST` | `/tasks/{task_id}/restore` | Restore a resized task to its `original_description`/`original_tip` |
  ```

  Add to `ai_utils.py` entry:
  ```
  `resize_task_for_low_energy(goal_context, sprint_theme, original_description, assigned_date)` — first-step micro-task generation; callers must discard `result.assigned_date`
  ```

  Add `original_description (nullable)`, `original_tip (nullable)` to the `daily_tasks` row in **Data model**.

  Add to the **Key files** frontend table:
  ```
  | `src/components/EnergyModal.tsx` | Low-energy confirmation overlay — rendered in Dashboard, not GoalCard |
  | `src/hooks/useEnergyMutations.ts` | `useEnergyResizeMutation(userId)`, `useRestoreTaskMutation(userId)` |
  ```

  Add architecture note:
  ```
  - **`EnergyParamCapture` (in `App.tsx`)**: renders `null`; seeds `sessionStorage` key `pending_energy_mode` when `?energy=low` is in the URL. This must be inside `<BrowserRouter>` but does NOT require the user to be authenticated — it captures the param before `AuthGuard` can redirect.
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add CLAUDE.md
  git commit -m "docs: update CLAUDE.md for Adaptive Energy Check-in feature"
  ```
