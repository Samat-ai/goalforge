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
from schemas import AICoachTurnV2, AIGuardVerdict, AIMilestoneConfig, AIGoalOutput, AITaskOutput
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
        patch("routes.goals.classify_user_input", new=AsyncMock(return_value=AIGuardVerdict(verdict="allow", category="on_topic"))),
        patch("routes.milestones.generate_sprint_tasks", new=AsyncMock(return_value=mock_tasks)),
        patch("services.task_service._pre_generate_sprint", new=AsyncMock()),
        patch("routes.tasks.regenerate_single_task", new=AsyncMock(return_value=mock_regen)),
        patch("services.reward_service.roll_reward", return_value="standard"),  # always standard in tests
        patch("routes.coach.classify_user_input", new=AsyncMock(return_value=AIGuardVerdict(verdict="allow", category="on_topic"))),
        patch("routes.coach.generate_coach_reply", new=AsyncMock(return_value=AICoachTurnV2(reply="Noted. What outcome do you want in 90 days?", intent="chat", chips=["Get fit", "Ship my project"]))),
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
        patch("routes.goals.classify_user_input", new=AsyncMock(return_value=AIGuardVerdict(verdict="allow", category="on_topic"))),
        patch("routes.milestones.generate_sprint_tasks", new=AsyncMock(return_value=mock_tasks)),
        patch("services.task_service._pre_generate_sprint", new=AsyncMock()),
        patch("routes.tasks.regenerate_single_task", new=AsyncMock(return_value=mock_regen)),
        patch("services.reward_service.roll_reward", return_value="standard"),  # always standard in tests
        patch("routes.coach.classify_user_input", new=AsyncMock(return_value=AIGuardVerdict(verdict="allow", category="on_topic"))),
        patch("routes.coach.generate_coach_reply", new=AsyncMock(return_value=AICoachTurnV2(reply="Noted. What outcome do you want in 90 days?", intent="chat", chips=["Get fit", "Ship my project"]))),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Shared helper — create a goal and return the response JSON
# ---------------------------------------------------------------------------

async def wait_for_goal_generated(client: AsyncClient, goal_id: str) -> dict:
    """Poll GET /goals/{id} until background generation lands (or fail after ~2.5s).

    BackgroundTasks usually complete before the ASGI test client call returns,
    but that ordering is not guaranteed by the stack — it flaked on CI.
    """
    for _ in range(50):
        get_resp = await client.get(f"/goals/{goal_id}")
        assert get_resp.status_code == 200
        data = get_resp.json()
        if all(m["sprint_status"] != "generating" for m in data["milestones"]):
            return data
        await asyncio.sleep(0.05)
    raise AssertionError(f"Goal {goal_id} still generating after 2.5s")


async def create_test_goal(client: AsyncClient) -> dict:
    resp = await client.post(
        f"/users/{TEST_USER_ID}/goals",
        json={"raw_input": "I want to run a 5K race in under 25 minutes within 3 months"},
    )
    assert resp.status_code == 202
    return await wait_for_goal_generated(client, resp.json()["id"])


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


# ---------------------------------------------------------------------------
# Factory fixtures — create DB records directly and return model instances
# ---------------------------------------------------------------------------

from datetime import timedelta
from models import User


async def _ensure_user(db_session: AsyncSession, user_id: str, email: str) -> None:
    """Insert the user row if it doesn't exist yet (Goal FK requires it)."""
    existing = await db_session.get(User, user_id)
    if existing is None:
        db_session.add(User(id=user_id, email=email, star_points=0, timezone="UTC"))
        await db_session.flush()


@pytest_asyncio.fixture
async def make_goal(db_session):
    """Factory fixture: create a Goal record and return the model instance.

    Usage::

        goal = await make_goal()
        goal = await make_goal(title="Custom title", status="achieved")
    """
    async def _make(
        title: str = "Test goal",
        status: str = "active",
        progress: int = 0,
        user_id: str = TEST_USER_ID,
        **kwargs,
    ) -> Goal:
        await _ensure_user(db_session, user_id, f"{user_id}@example.com")
        goal = Goal(
            user_id=user_id,
            raw_input=title,
            smart_title=title,
            smart_description="A test goal created by the make_goal factory.",
            goal_type="personal",
            target_date=date.today() + timedelta(days=30),
            status=status,
            progress=progress,
            **kwargs,
        )
        db_session.add(goal)
        await db_session.flush()
        return goal

    return _make


@pytest_asyncio.fixture
async def make_milestone(db_session):
    """Factory fixture: create a Milestone record and return the model instance.

    Usage::

        milestone = await make_milestone(goal_id=goal.id)
        milestone = await make_milestone(goal_id=goal.id, title="Phase 1", position=1)
    """
    async def _make(
        goal_id,
        title: str = "Test milestone",
        position: int = 1,
        sprint_theme: str = "test sprint",
        sprint_status: str = "active",
        is_final: bool = False,
        **kwargs,
    ) -> Milestone:
        milestone = Milestone(
            goal_id=goal_id,
            title=title,
            position=position,
            sprint_theme=sprint_theme,
            sprint_status=sprint_status,
            is_final=is_final,
            **kwargs,
        )
        db_session.add(milestone)
        await db_session.flush()
        return milestone

    return _make


@pytest_asyncio.fixture
async def make_task(db_session):
    """Factory fixture: create a DailyTask record and return the model instance.

    Usage::

        task = await make_task(goal_id=goal.id)
        task = await make_task(goal_id=goal.id, milestone_id=milestone.id, is_completed=True)
    """
    async def _make(
        goal_id,
        milestone_id=None,
        description: str = "Test task",
        tip: str = "Keep going.",
        assigned_date=None,
        is_completed: bool = False,
        **kwargs,
    ) -> DailyTask:
        task = DailyTask(
            goal_id=goal_id,
            milestone_id=milestone_id,
            description=description,
            tip=tip,
            assigned_date=assigned_date if assigned_date is not None else date.today(),
            is_completed=is_completed,
            **kwargs,
        )
        db_session.add(task)
        await db_session.flush()
        return task

    return _make
