"""
Shared pytest fixtures for GoalForge API tests.

Strategy:
- SQLite in-memory database via aiosqlite (fast, no external deps)
- Fresh schema per test (function-scoped engine)
- FastAPI dependency overrides for get_db, auth deps
- All Gemini calls mocked — no real AI calls are made
"""

from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from auth import get_current_user_email, get_current_user_id
from database import Base, get_db
from main import app
from schemas import AIMilestoneConfig, AIGoalOutput, AITaskOutput

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
    today = date.today()
    return AIGoalOutput(
        smart_title="Run 5K in under 25 minutes",
        smart_description=(
            "Train consistently over 90 days to complete a 5 km run in under "
            "25 minutes, building endurance and speed progressively."
        ),
        goal_type="fitness",
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
    today = date.today()
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

    mock_regen = AITaskOutput(description="Regenerated task", tip="Fresh motivation", assigned_date=date.today())

    with (
        patch("routes.goals.generate_smart_goal", new=AsyncMock(return_value=mock_goal)),
        patch("routes.milestones.generate_sprint_tasks", new=AsyncMock(return_value=mock_tasks)),
        patch("services.task_service._pre_generate_sprint", new=AsyncMock()),
        patch("routes.tasks.regenerate_single_task", new=AsyncMock(return_value=mock_regen)),
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

    mock_regen = AITaskOutput(description="Regenerated task", tip="Fresh motivation", assigned_date=date.today())

    with (
        patch("routes.goals.generate_smart_goal", new=AsyncMock(return_value=mock_goal)),
        patch("routes.milestones.generate_sprint_tasks", new=AsyncMock(return_value=mock_tasks)),
        patch("services.task_service._pre_generate_sprint", new=AsyncMock()),
        patch("routes.tasks.regenerate_single_task", new=AsyncMock(return_value=mock_regen)),
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
    assert resp.status_code == 201
    return resp.json()
