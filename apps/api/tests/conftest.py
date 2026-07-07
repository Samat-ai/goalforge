"""
Shared pytest fixtures for GoalForge API tests.

Strategy:
- SQLite in-memory database via aiosqlite (fast, no external deps)
- Fresh schema per test (function-scoped engine)
- FastAPI dependency overrides for get_db, auth deps
- All Gemini calls mocked — no real AI calls are made
"""

import asyncio
import os
import uuid
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio


_EXIT_STATUS = 0


def pytest_sessionfinish(session, exitstatus):
    global _EXIT_STATUS
    _EXIT_STATUS = int(exitstatus)


def pytest_unconfigure(config):
    """Force-exit the process after all tests finish.

    Without this, aiosqlite's internal thread pool keeps the Python process alive
    indefinitely on Linux CI after all tests pass — causing a 10+ minute hang.
    os._exit() bypasses Python's atexit/finalizer machinery and kills the process
    immediately, which is safe because all test results have already been collected.
    Exiting in unconfigure (not sessionfinish) lets the terminal reporter print
    the failure summary first; the flushes push it past os._exit(), which skips
    buffer flushing.
    """
    import sys
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(_EXIT_STATUS)
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete as sql_delete, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from auth import get_current_user_email, get_current_user_id
from database import Base, get_db
from main import app
from models import DailyTask, Goal, Milestone
from schemas import AIMilestoneConfig, AIGoalOutput, AITaskOutput
from services.goal_service import PLACEHOLDER_MILESTONE_TITLE
from utils import user_today


def utc_today() -> date:
    """Today as the backend computes it for the default-UTC test user.

    Tests MUST use this instead of date.today(): routes resolve "today" via
    user_today(user.timezone) and the test user's timezone is UTC, so local
    date.today() diverges from the backend whenever the machine clock is on
    the other side of the UTC date boundary (e.g. evenings in UTC+ zones).
    """
    return user_today("UTC")

# ---------------------------------------------------------------------------
# Autouse: cancel lingering background tasks after each test (prevents event
# loop hang on Linux CI when asyncio.create_task() tasks outlive their test).
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(autouse=True)
async def cancel_pending_tasks():
    yield
    tasks = {t for t in asyncio.all_tasks() if t is not asyncio.current_task()}
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


# ---------------------------------------------------------------------------
# Test identity constants
# ---------------------------------------------------------------------------

TEST_USER_ID = "user_test_abc123"
TEST_USER_EMAIL = "test@example.com"
OTHER_USER_ID = "user_other_xyz789"


# ---------------------------------------------------------------------------
# Mock AI output
# ---------------------------------------------------------------------------

def _make_mock_goal_output() -> AIGoalOutput:
    today = utc_today()
    return AIGoalOutput(
        smart_title="Run 5K in under 25 minutes",
        smart_description=(
            "Train consistently over 90 days to complete a 5 km run in under "
            "25 minutes, building endurance and speed progressively."
        ),
        goal_type="health",
        target_date=today + timedelta(days=90),
        milestones=[
            AIMilestoneConfig(
                title="Foundation Fitness",
                sprint_theme="Build running base",
                is_final=False,
            ),
            AIMilestoneConfig(
                title="Speed Training",
                sprint_theme="Interval speed work",
                is_final=False,
            ),
            AIMilestoneConfig(
                title="Race Preparation",
                sprint_theme="Final prep and taper",
                is_final=True,
            ),
        ],
        initial_tasks=[
            AITaskOutput(
                description=f"Day {i + 1}: easy 20-minute run",
                tip="Consistency beats intensity at this stage.",
                assigned_date=today + timedelta(days=i),
            )
            for i in range(7)
        ],
    )


def _make_mock_sprint_tasks() -> list[AITaskOutput]:
    today = utc_today()
    return [
        AITaskOutput(
            description=f"Sprint day {i + 1} task",
            tip="Keep pushing forward.",
            assigned_date=today + timedelta(days=i),
        )
        for i in range(7)
    ]


# ---------------------------------------------------------------------------
# Database fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def engine():
    """Fresh in-memory SQLite engine with all tables created."""
    _engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield _engine
    await _engine.dispose()


@pytest_asyncio.fixture
async def client(engine):
    """
    AsyncClient wired to the FastAPI app with:
    - get_db overridden to use the test SQLite engine
    - Auth deps overridden to return TEST_USER_ID / TEST_USER_EMAIL
    - Gemini functions and background pre-gen mocked
    """
    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    app.dependency_overrides[get_current_user_email] = lambda: TEST_USER_EMAIL

    mock_goal = _make_mock_goal_output()
    mock_tasks = _make_mock_sprint_tasks()

    mock_regen = AITaskOutput(description="Regenerated task", tip="Fresh motivation", assigned_date=utc_today())

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

    with (
        patch("routes.goals._generate_goal_async", new=_mock_generate_goal_async),
        patch("routes.milestones.generate_sprint_tasks", new=AsyncMock(return_value=mock_tasks)),
        patch("services.task_service._pre_generate_sprint", new=AsyncMock()),
        patch("routes.tasks.regenerate_single_task", new=AsyncMock(return_value=mock_regen)),
        patch("services.reward_service.roll_reward", return_value="standard"),  # always standard in tests
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def other_client(engine):
    """
    Like `client` but authenticated as OTHER_USER_ID.
    Shares the same engine so it can see data created by `client`.
    """
    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
    app.dependency_overrides[get_current_user_email] = lambda: "other@example.com"

    mock_goal = _make_mock_goal_output()
    mock_tasks = _make_mock_sprint_tasks()

    mock_regen = AITaskOutput(description="Regenerated task", tip="Fresh motivation", assigned_date=utc_today())

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

    with (
        patch("routes.goals._generate_goal_async", new=_mock_generate_goal_async),
        patch("routes.milestones.generate_sprint_tasks", new=AsyncMock(return_value=mock_tasks)),
        patch("services.task_service._pre_generate_sprint", new=AsyncMock()),
        patch("routes.tasks.regenerate_single_task", new=AsyncMock(return_value=mock_regen)),
        patch("services.reward_service.roll_reward", return_value="standard"),  # always standard in tests
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Shared helper — create a goal and return the response JSON
# ---------------------------------------------------------------------------

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


@pytest_asyncio.fixture
async def db_session(engine):
    """Direct AsyncSession for test setup/teardown (bypasses HTTP layer)."""
    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def created_goal(client):
    """A fully-generated goal dict (same as calling create_test_goal(client))."""
    return await create_test_goal(client)
