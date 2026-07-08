#!/usr/bin/env python3
"""
GoalForge development seed script.
Populates the database with realistic demo data for development and testing.

Usage:
    python seed.py                    # Seed with default demo user
    python seed.py --user-id <id>     # Seed for a specific Clerk user ID
    python seed.py --clear            # Clear all data before seeding
    python seed.py --clear --user-id <id>  # Clear then seed for user

WARNING: Never run against production database.
"""

import asyncio
import argparse
import sys
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4
import random

# ---------------------------------------------------------------------------
# Production guard — must happen before any DB import
# ---------------------------------------------------------------------------
from config import settings

if settings.environment == "production":
    print("ERROR: Refusing to seed production database.")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Remaining imports (after the guard so we don't touch prod settings)
# ---------------------------------------------------------------------------
from sqlalchemy import select, delete, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, engine, Base
import models
from seed_config import (
    DEMO_GOALS,
    DEMO_TASKS,
    DEMO_COACH_MESSAGES,
    DEMO_STAR_LOG_NARRATIVES,
    DEMO_WEEKLY_REFLECTION,
    DEMO_REWARDS,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_USER_ID = "user_demo_001"
DEFAULT_EMAIL = "demo@goalforge.dev"
TODAY = date.today()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _random_seed() -> None:
    """Fix the random seed so runs are deterministic."""
    random.seed(42)


def _days_ago(n: int) -> date:
    return TODAY - timedelta(days=n)


def _dt_utc(d: date, hour: int = 8, minute: int = 0) -> datetime:
    """Return a timezone-aware UTC datetime for a given date."""
    return datetime(d.year, d.month, d.day, hour, minute, tzinfo=timezone.utc)


def _pick_tasks(pool: list[dict], n: int) -> list[dict]:
    """Sample n tasks from a pool, cycling if the pool is smaller than n."""
    result = []
    for i in range(n):
        result.append(pool[i % len(pool)])
    return result


# ---------------------------------------------------------------------------
# Clear
# ---------------------------------------------------------------------------

async def clear_user_data(session: AsyncSession, user_id: str) -> None:
    """Delete all data owned by user_id (cascade handles child rows)."""
    print(f"  Deleting all data for user '{user_id}' ...")
    await session.execute(delete(models.User).where(models.User.id == user_id))
    await session.flush()
    print("  Done.")


# ---------------------------------------------------------------------------
# Section seeders
# ---------------------------------------------------------------------------

async def seed_user(session: AsyncSession, user_id: str) -> models.User:
    """Insert or skip the demo user."""
    existing = await session.get(models.User, user_id)
    if existing:
        print(f"  User '{user_id}' already exists — skipping.")
        return existing

    user = models.User(
        id=user_id,
        email=DEFAULT_EMAIL if user_id == DEFAULT_USER_ID else f"{user_id}@goalforge.dev",
        star_points=340,
        timezone="America/New_York",
        display_name="Alex Demo",
        reminder_enabled=True,
        reminder_hour=9,
        created_at=_dt_utc(_days_ago(35)),
    )
    session.add(user)
    await session.flush()
    print(f"  Created user '{user_id}'.")
    return user


async def seed_rewards(
    session: AsyncSession,
    user_id: str,
    reward_defs: list[dict],
) -> None:
    """Insert rewards, skipping duplicates via ON CONFLICT DO NOTHING."""
    count = 0
    for r in reward_defs:
        stmt = (
            pg_insert(models.Reward)
            .values(
                id=uuid4(),
                user_id=user_id,
                reward_type=r["reward_type"],
                reward_key=r["reward_key"],
                is_equipped=r["is_equipped"],
                acquired_at=_dt_utc(_days_ago(random.randint(3, 20))),
            )
            .on_conflict_do_nothing(constraint="uq_rewards_user_key")
        )
        await session.execute(stmt)
        count += 1
    await session.flush()
    print(f"  Seeded {count} rewards (duplicates skipped).")


async def seed_goal_running(
    session: AsyncSession,
    user_id: str,
    goal_def: dict,
) -> models.Goal:
    """Seed Goal 1: 5K running — 28 days of task history, ~75% completion."""

    # -- Goal row --
    goal_id = uuid4()
    target = TODAY + timedelta(weeks=goal_def["weeks_until_target"])
    goal = models.Goal(
        id=goal_id,
        user_id=user_id,
        raw_input=goal_def["raw_input"],
        smart_title=goal_def["smart_title"],
        smart_description=goal_def["smart_description"],
        goal_type=goal_def["goal_type"],
        target_date=target,
        status=goal_def["status"],
        progress=goal_def["progress"],
        achievement_reward_granted=goal_def["achievement_reward_granted"],
        created_at=_dt_utc(_days_ago(35)),
    )
    session.add(goal)
    await session.flush()

    # -- Milestones --
    milestone_ids: list[uuid4] = []
    completed_ms_ids: list[uuid4] = []
    active_milestone_id = None

    for ms_def in goal_def["milestones"]:
        ms_id = uuid4()
        ms = models.Milestone(
            id=ms_id,
            goal_id=goal_id,
            title=ms_def["title"],
            position=ms_def["position"],
            is_final=ms_def["is_final"],
            sprint_theme=ms_def["sprint_theme"],
            sprint_status=ms_def["sprint_status"],
            is_completed=ms_def["is_completed"],
            completed_at=_dt_utc(_days_ago(14)) if ms_def["is_completed"] else None,
            created_at=_dt_utc(_days_ago(35)),
        )
        session.add(ms)
        milestone_ids.append(ms_id)
        if ms_def["is_completed"]:
            completed_ms_ids.append(ms_id)
        if ms_def["sprint_status"] == "active":
            active_milestone_id = ms_id
    await session.flush()

    # -- Historical tasks: 28 days, 3 tasks/day, ~75% completion --
    task_pool = DEMO_TASKS["running"]
    rescue_pool = DEMO_TASKS["running_rescue"]
    tasks_added = 0

    for day_offset in range(28, 0, -1):
        day = _days_ago(day_offset)
        # Assign to completed milestone for older days, active for recent ones
        if day_offset > 14:
            ms_id = completed_ms_ids[0] if completed_ms_ids else milestone_ids[0]
        else:
            ms_id = active_milestone_id or milestone_ids[1]

        for pos in range(3):
            is_rescue = (pos == 2) and (day_offset % 7 == 0)
            task_def = (
                rescue_pool[day_offset % len(rescue_pool)]
                if is_rescue
                else task_pool[(day_offset * 3 + pos) % len(task_pool)]
            )

            # ~75% completion
            completed = random.random() < 0.75
            completed_at = _dt_utc(day, hour=7 + pos) if completed else None

            task = models.DailyTask(
                id=uuid4(),
                goal_id=goal_id,
                milestone_id=ms_id,
                description=task_def["description"],
                tip=task_def["tip"],
                assigned_date=day,
                position=pos,
                is_completed=completed,
                is_rescue_task=is_rescue,
                is_user_added=False,
                completed_at=completed_at,
            )
            session.add(task)
            tasks_added += 1

    await session.flush()
    print(f"  Seeded running goal with {tasks_added} historical tasks.")
    return goal


async def seed_goal_typescript(
    session: AsyncSession,
    user_id: str,
    goal_def: dict,
) -> models.Goal:
    """Seed Goal 2: TypeScript — 14 days of task history, ~60% completion."""

    goal_id = uuid4()
    target = TODAY + timedelta(weeks=goal_def["weeks_until_target"])
    goal = models.Goal(
        id=goal_id,
        user_id=user_id,
        raw_input=goal_def["raw_input"],
        smart_title=goal_def["smart_title"],
        smart_description=goal_def["smart_description"],
        goal_type=goal_def["goal_type"],
        target_date=target,
        status=goal_def["status"],
        progress=goal_def["progress"],
        achievement_reward_granted=goal_def["achievement_reward_granted"],
        created_at=_dt_utc(_days_ago(20)),
    )
    session.add(goal)
    await session.flush()

    milestone_ids: list[uuid4] = []
    active_milestone_id = None

    for ms_def in goal_def["milestones"]:
        ms_id = uuid4()
        ms = models.Milestone(
            id=ms_id,
            goal_id=goal_id,
            title=ms_def["title"],
            position=ms_def["position"],
            is_final=ms_def["is_final"],
            sprint_theme=ms_def["sprint_theme"],
            sprint_status=ms_def["sprint_status"],
            is_completed=ms_def["is_completed"],
            completed_at=None,
            created_at=_dt_utc(_days_ago(20)),
        )
        session.add(ms)
        milestone_ids.append(ms_id)
        if ms_def["sprint_status"] == "active":
            active_milestone_id = ms_id
    await session.flush()

    task_pool = DEMO_TASKS["typescript"]
    tasks_added = 0

    for day_offset in range(14, 0, -1):
        day = _days_ago(day_offset)
        ms_id = active_milestone_id or milestone_ids[0]

        for pos in range(2):
            task_def = task_pool[(day_offset * 2 + pos) % len(task_pool)]
            completed = random.random() < 0.60
            completed_at = _dt_utc(day, hour=19 + pos) if completed else None

            task = models.DailyTask(
                id=uuid4(),
                goal_id=goal_id,
                milestone_id=ms_id,
                description=task_def["description"],
                tip=task_def["tip"],
                assigned_date=day,
                position=pos,
                is_completed=completed,
                is_rescue_task=False,
                is_user_added=False,
                completed_at=completed_at,
            )
            session.add(task)
            tasks_added += 1

    await session.flush()
    print(f"  Seeded TypeScript goal with {tasks_added} historical tasks.")
    return goal


async def seed_goal_savings(
    session: AsyncSession,
    user_id: str,
    goal_def: dict,
) -> models.Goal:
    """Seed Goal 3: savings — 90 days of task history, achieved."""

    goal_id = uuid4()
    created_at = _dt_utc(_days_ago(94))
    target = TODAY + timedelta(weeks=goal_def["weeks_until_target"])
    goal = models.Goal(
        id=goal_id,
        user_id=user_id,
        raw_input=goal_def["raw_input"],
        smart_title=goal_def["smart_title"],
        smart_description=goal_def["smart_description"],
        goal_type=goal_def["goal_type"],
        target_date=target,
        status=goal_def["status"],
        progress=goal_def["progress"],
        achievement_reward_granted=goal_def["achievement_reward_granted"],
        created_at=created_at,
    )
    session.add(goal)
    await session.flush()

    milestone_ids: list[uuid4] = []
    # Space completions evenly across the 90-day window
    milestone_completion_offsets = [72, 48, 24, 5]

    for i, ms_def in enumerate(goal_def["milestones"]):
        ms_id = uuid4()
        ms = models.Milestone(
            id=ms_id,
            goal_id=goal_id,
            title=ms_def["title"],
            position=ms_def["position"],
            is_final=ms_def["is_final"],
            sprint_theme=ms_def["sprint_theme"],
            sprint_status=ms_def["sprint_status"],
            is_completed=ms_def["is_completed"],
            completed_at=_dt_utc(_days_ago(milestone_completion_offsets[i])),
            created_at=created_at,
        )
        session.add(ms)
        milestone_ids.append(ms_id)
    await session.flush()

    task_pool = DEMO_TASKS["savings"]
    rescue_pool = DEMO_TASKS["savings_rescue"]
    tasks_added = 0

    for day_offset in range(90, 0, -1):
        day = _days_ago(day_offset)
        # Assign milestone based on quarter of the 90-day window
        quarter = (90 - day_offset) // 23  # 0..3
        ms_id = milestone_ids[min(quarter, len(milestone_ids) - 1)]

        is_rescue = (day_offset % 10 == 0)
        task_def = (
            rescue_pool[day_offset % len(rescue_pool)]
            if is_rescue
            else task_pool[day_offset % len(task_pool)]
        )

        # Savings goal had very high completion (~90%)
        completed = random.random() < 0.90
        completed_at = _dt_utc(day, hour=20) if completed else None

        task = models.DailyTask(
            id=uuid4(),
            goal_id=goal_id,
            milestone_id=ms_id,
            description=task_def["description"],
            tip=task_def["tip"],
            assigned_date=day,
            position=0,
            is_completed=completed,
            is_rescue_task=is_rescue,
            is_user_added=False,
            completed_at=completed_at,
        )
        session.add(task)
        tasks_added += 1

    await session.flush()
    print(f"  Seeded savings goal ({goal_def['status']}) with {tasks_added} historical tasks.")
    return goal


async def seed_coach_session(
    session: AsyncSession,
    user_id: str,
    goal: models.Goal,
) -> None:
    """Seed one completed coaching session linked to Goal 1."""
    coach_session_id = uuid4()
    created_at = _dt_utc(_days_ago(35))
    coach_session = models.CoachSession(
        id=coach_session_id,
        user_id=user_id,
        stage=5,
        is_completed=True,
        forged_goal_id=goal.id,
        created_at=created_at,
        updated_at=_dt_utc(_days_ago(35), hour=9, minute=15),
    )
    session.add(coach_session)
    await session.flush()

    for i, msg_def in enumerate(DEMO_COACH_MESSAGES):
        msg = models.CoachMessage(
            id=uuid4(),
            session_id=coach_session_id,
            role=msg_def["role"],
            content=msg_def["content"],
            created_at=_dt_utc(_days_ago(35), hour=9, minute=i),
        )
        session.add(msg)
    await session.flush()
    print(f"  Seeded coaching session ({len(DEMO_COACH_MESSAGES)} messages).")


async def seed_star_logs(session: AsyncSession, user_id: str) -> None:
    """Seed 2 weekly star logs using ON CONFLICT DO NOTHING."""
    # Week 1: days 14–8 ago
    week1_start = _days_ago(14)
    week1_end = _days_ago(8)
    # Week 2: days 7–1 ago
    week2_start = _days_ago(7)
    week2_end = _days_ago(1)

    date_ranges = [
        (week1_start, week1_end, DEMO_STAR_LOG_NARRATIVES[0]),
        (week2_start, week2_end, DEMO_STAR_LOG_NARRATIVES[1]),
    ]

    for start, end, narrative in date_ranges:
        stmt = (
            pg_insert(models.StarLog)
            .values(
                id=uuid4(),
                user_id=user_id,
                start_date=start,
                end_date=end,
                completed_tasks=narrative["completed_tasks"],
                completed_days=narrative["completed_days"],
                chapter_title=narrative["chapter_title"],
                chapter_body=narrative["chapter_body"],
                highlights=narrative["highlights"],
                is_fallback=narrative["is_fallback"],
                created_at=_dt_utc(end, hour=23),
            )
            .on_conflict_do_nothing(constraint="uq_star_log_user_period")
        )
        await session.execute(stmt)
    await session.flush()
    print(f"  Seeded {len(date_ranges)} star logs.")


async def seed_weekly_reflection(session: AsyncSession, user_id: str) -> None:
    """Seed one weekly reflection entry."""
    r = DEMO_WEEKLY_REFLECTION
    reflection = models.WeeklyReflection(
        id=uuid4(),
        user_id=user_id,
        went_well=r["went_well"],
        blockers=r["blockers"],
        week_rating=r["week_rating"],
        coach_recommendation=r["coach_recommendation"],
        created_at=_dt_utc(_days_ago(7), hour=21),
    )
    session.add(reflection)
    await session.flush()
    print("  Seeded weekly reflection.")


# ---------------------------------------------------------------------------
# Idempotency check
# ---------------------------------------------------------------------------

async def user_already_seeded(session: AsyncSession, user_id: str) -> bool:
    """Return True if the user already has at least one goal."""
    result = await session.execute(
        select(models.Goal).where(models.Goal.user_id == user_id).limit(1)
    )
    return result.scalar_one_or_none() is not None


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

async def run_seed(user_id: str, clear: bool) -> None:
    _random_seed()
    async with AsyncSessionLocal() as session:
        async with session.begin():
            # -- Clear --
            if clear:
                print("\n[clear] Removing existing data ...")
                await clear_user_data(session, user_id)

            # -- Idempotency guard --
            if not clear and await user_already_seeded(session, user_id):
                print(
                    f"\nUser '{user_id}' already has seeded data. "
                    "Use --clear to wipe and re-seed."
                )
                return

            print(f"\n[seed] Seeding demo data for user '{user_id}' ...\n")

            # 1. User
            print("[1/7] User ...")
            user = await seed_user(session, user_id)

            # 2. Rewards / collectibles
            print("\n[2/7] Rewards ...")
            await seed_rewards(session, user_id, DEMO_REWARDS)

            # 3. Goal 1 — running (active, 60%)
            print("\n[3/7] Goal 1 — running ...")
            running_goal = await seed_goal_running(session, user_id, DEMO_GOALS[0])

            # 4. Goal 2 — TypeScript (active, 30%)
            print("\n[4/7] Goal 2 — TypeScript ...")
            await seed_goal_typescript(session, user_id, DEMO_GOALS[1])

            # 5. Goal 3 — savings (achieved, 100%)
            print("\n[5/7] Goal 3 — savings ...")
            await seed_goal_savings(session, user_id, DEMO_GOALS[2])

            # 6. Coach session (linked to running goal)
            print("\n[6/7] Coach session ...")
            await seed_coach_session(session, user_id, running_goal)

            # 7a. Star logs
            print("\n[7/7] Star logs & reflections ...")
            await seed_star_logs(session, user_id)

            # 7b. Weekly reflection
            await seed_weekly_reflection(session, user_id)

            print("\n✓ Seed complete.\n")
            _print_summary(user_id)


def _print_summary(user_id: str) -> None:
    print("=" * 60)
    print("  GoalForge demo data summary")
    print("=" * 60)
    print(f"  User ID    : {user_id}")
    print(f"  Star points: 340")
    print(f"  Timezone   : America/New_York")
    print()
    print("  Goals:")
    print("    1. Run a 5K in under 30 minutes  [health, active, 60%]")
    print("       - 4 milestones (1 completed, 1 active, 2 pending)")
    print("       - 28 days × 3 tasks/day, ~75% completion")
    print("       - Rescue tasks on weekly intervals")
    print("    2. Master TypeScript              [learning, active, 30%]")
    print("       - 3 milestones (1 active, 2 pending)")
    print("       - 14 days × 2 tasks/day, ~60% completion")
    print("    3. Build a $5,000 Emergency Fund  [finance, achieved, 100%]")
    print("       - 4 milestones (all completed)")
    print("       - 90 days × 1 task/day, ~90% completion")
    print()
    print("  Collectibles (5 rewards):")
    print("    - sunset_ember theme  [equipped]")
    print("    - streak_survivor title")
    print("    - lore_ember lore")
    print("    - comeback_kid title")
    print("    - lore_speck lore")
    print()
    print("  Coaching session: 1 completed (10 messages, Goal 1)")
    print("  Star logs       : 2 weekly entries")
    print("  Reflection      : 1 entry (week rating: 4/5)")
    print("=" * 60)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="GoalForge development seed script — populates demo data.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python seed.py\n"
            "  python seed.py --user-id user_2abc123\n"
            "  python seed.py --clear\n"
            "  python seed.py --clear --user-id user_2abc123\n"
        ),
    )
    parser.add_argument(
        "--user-id",
        default=DEFAULT_USER_ID,
        help=f"Clerk user ID to seed data for (default: {DEFAULT_USER_ID})",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Delete all existing data for the user before seeding",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(run_seed(user_id=args.user_id, clear=args.clear))
