"""
Reward Variability Engine — server-authoritative loot roll logic.

Public API:
  compute_consistency_score(user_id, db) -> int
  roll_reward(consistency_score) -> str   # 'standard'|'bonus'|'crit'|'jackpot'
  pick_collectible(tier, user_id, db) -> dict | None
  award_reward(user_id, tier, collectible, db) -> RewardResult
"""

import logging
import random
import uuid
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy import update as sql_update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from models import DailyTask, Goal, Reward, User

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Static collectible registry
# ---------------------------------------------------------------------------

COLLECTIBLE_REGISTRY: dict[str, list[dict]] = {
    "theme": [
        {"key": "neon_cyberpunk",  "display_name": "Neon Cyberpunk",  "body": None},
        {"key": "matcha_green",    "display_name": "Matcha Green",    "body": None},
        {"key": "midnight_ocean",  "display_name": "Midnight Ocean",  "body": None},
        {"key": "sunset_ember",    "display_name": "Sunset Ember",    "body": None},
    ],
    "title": [
        {"key": "the_relentless",     "display_name": "The Relentless",     "body": None},
        {"key": "streak_survivor",    "display_name": "Streak Survivor",    "body": None},
        {"key": "comeback_kid",       "display_name": "Comeback Kid",       "body": None},
        {"key": "night_owl",          "display_name": "Night Owl",          "body": None},
        {"key": "early_riser",        "display_name": "Early Riser",        "body": None},
        {"key": "the_consistent",     "display_name": "The Consistent",     "body": None},
        {"key": "momentum_builder",   "display_name": "Momentum Builder",   "body": None},
        {"key": "habit_forger",       "display_name": "Habit Forger",       "body": None},
        {"key": "deep_focus",         "display_name": "Deep Focus",         "body": None},
        {"key": "the_persistent",     "display_name": "The Persistent",     "body": None},
        {"key": "rising_star",        "display_name": "Rising Star",        "body": None},
        {"key": "unstoppable",        "display_name": "Unstoppable",        "body": None},
    ],
    "lore": [
        {
            "key": "lore_speck",
            "display_name": "The Speck Awakens",
            "body": (
                "In the beginning there was only potential — a single point of light no larger "
                "than a dust mote. Yet within it stirred the first whisper of ambition. The Speck "
                "did not know what it would become, only that it must move."
            ),
        },
        {
            "key": "lore_ember",
            "display_name": "The Ember's Oath",
            "body": (
                "When the Speck first caught the heat of consistent effort, it became an Ember. "
                "Embers are fragile, but they remember the cold. Every small action fed the glow "
                "until darkness itself learned to step aside."
            ),
        },
        {
            "key": "lore_flare",
            "display_name": "The Flare Ignites",
            "body": (
                "A Flare is born in the moment discipline becomes instinct. What once required "
                "willpower now simply happens. The Flare does not fight the day — it illuminates it."
            ),
        },
        {
            "key": "lore_luminary",
            "display_name": "The Luminary Rises",
            "body": (
                "Luminaries are visible from a distance. Not because they seek attention, but "
                "because sustained effort radiates outward. Others begin to orbit their momentum."
            ),
        },
        {
            "key": "lore_nova",
            "display_name": "The Nova Expands",
            "body": (
                "The Nova stage marks the moment a goal-seeker stops becoming and starts being. "
                "The energy no longer comes from outside — it generates itself. A Nova does not "
                "burn out. It expands."
            ),
        },
        {
            "key": "lore_celestial",
            "display_name": "The Celestial Endures",
            "body": (
                "Celestials are those who have proven that consistency is not a phase but a nature. "
                "They have forgotten what it feels like to quit, because quitting requires imagining "
                "a self that is less than what they have already become."
            ),
        },
    ],
}

# Fast lookup: key -> {reward_type, display_name, body, key}
_REGISTRY_BY_KEY: dict[str, dict] = {
    item["key"]: {"reward_type": ctype, **item}
    for ctype, items in COLLECTIBLE_REGISTRY.items()
    for item in items
}


def get_collectible_info(reward_key: str) -> dict | None:
    """Look up display_name and body for a reward_key. Returns None if not in registry."""
    return _REGISTRY_BY_KEY.get(reward_key)


# ---------------------------------------------------------------------------
# Odds table (each row sums to 1.0)
# ---------------------------------------------------------------------------

ODDS_TABLE: dict[str, list[tuple[str, float]]] = {
    "base":     [("standard", 0.71), ("bonus", 0.20), ("crit", 0.08), ("jackpot", 0.01)],
    "improved": [("standard", 0.68), ("bonus", 0.20), ("crit", 0.10), ("jackpot", 0.02)],
    "high":     [("standard", 0.62), ("bonus", 0.18), ("crit", 0.15), ("jackpot", 0.05)],
    "max":      [("standard", 0.55), ("bonus", 0.15), ("crit", 0.20), ("jackpot", 0.10)],
}

TIER_POINTS: dict[str, int] = {
    "standard": 10,
    "bonus": 15,
    "crit": 25,
    "jackpot": 50,
}

# Which collectible types each loot tier can drop
_TIER_COLLECTIBLE_TYPES: dict[str, list[str]] = {
    "crit":    ["lore"],
    "jackpot": ["theme", "title"],
}


def _consistency_tier(score: int) -> str:
    if score >= 12:
        return "max"
    if score >= 8:
        return "high"
    if score >= 4:
        return "improved"
    return "base"


# ---------------------------------------------------------------------------
# compute_consistency_score
# ---------------------------------------------------------------------------

async def compute_consistency_score(user_id: str, db: AsyncSession) -> int:
    """
    Count distinct calendar days in the last 14 days on which the user
    completed at least one task. Uses user's timezone for window-start calculation.
    """
    from utils import user_today  # avoid circular at module level
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    tz_str = (user.timezone if user and user.timezone else "UTC") or "UTC"

    try:
        user_tz = ZoneInfo(tz_str)
    except (ZoneInfoNotFoundError, KeyError, TypeError):
        user_tz = ZoneInfo("UTC")

    today = user_today(tz_str)
    window_start_date = today - timedelta(days=13)  # 14-day window inclusive
    window_start_dt = datetime.combine(window_start_date, time.min).replace(tzinfo=user_tz)

    result = await db.execute(
        select(func.count(func.distinct(func.date(DailyTask.completed_at))))
        .select_from(DailyTask)
        .join(Goal, Goal.id == DailyTask.goal_id)
        .where(
            Goal.user_id == user_id,
            DailyTask.completed_at >= window_start_dt,
            DailyTask.is_completed == True,  # noqa: E712
        )
    )
    return result.scalar_one() or 0


# ---------------------------------------------------------------------------
# roll_reward
# ---------------------------------------------------------------------------

def roll_reward(consistency_score: int) -> str:
    """Weighted random loot tier. Returns 'standard' | 'bonus' | 'crit' | 'jackpot'."""
    tier = _consistency_tier(consistency_score)
    roll = random.random()
    cumulative = 0.0
    for name, prob in ODDS_TABLE[tier]:
        cumulative += prob
        if roll < cumulative:
            return name
    return "standard"  # floating-point safety fallback


# ---------------------------------------------------------------------------
# pick_collectible
# ---------------------------------------------------------------------------

async def pick_collectible(tier: str, user_id: str, db: AsyncSession) -> dict | None:
    """
    Select a random uncollected collectible for the given loot tier.
    Returns None if no collectibles available (pool exhausted or wrong tier).
    """
    collect_types = list(_TIER_COLLECTIBLE_TYPES.get(tier, []))
    if not collect_types:
        return None

    random.shuffle(collect_types)

    for ctype in collect_types:
        registry = COLLECTIBLE_REGISTRY.get(ctype, [])
        if not registry:
            continue

        owned_result = await db.execute(
            select(Reward.reward_key).where(
                Reward.user_id == user_id,
                Reward.reward_type == ctype,
            )
        )
        owned_keys = {row[0] for row in owned_result.all()}

        available = [item for item in registry if item["key"] not in owned_keys]
        if available:
            chosen = random.choice(available)
            return {"reward_type": ctype, **chosen}

    return None


# ---------------------------------------------------------------------------
# RewardResult dataclass
# ---------------------------------------------------------------------------

@dataclass
class RewardResult:
    tier: str
    points_awarded: int
    collectible_type: str | None
    collectible_key: str | None
    collectible_display_name: str | None
    collectible_body: str | None


# ---------------------------------------------------------------------------
# award_reward
# ---------------------------------------------------------------------------

async def award_reward(
    user_id: str,
    tier: str,
    collectible: dict | None,
    db: AsyncSession,
) -> RewardResult:
    """
    Atomically increment star_points by tier amount. Insert reward row if
    collectible is present, using savepoints to isolate IntegrityError from
    the points update. Retries pick_collectible up to 3 times on collision.
    """
    points = TIER_POINTS[tier]

    await db.execute(
        sql_update(User)
        .where(User.id == user_id)
        .values(star_points=User.star_points + points)
    )

    final_collectible = collectible
    if final_collectible:
        for attempt in range(3):
            try:
                async with db.begin_nested():
                    db.add(Reward(
                        id=uuid.uuid4(),
                        user_id=user_id,
                        reward_type=final_collectible["reward_type"],
                        reward_key=final_collectible["key"],
                        is_equipped=False,
                    ))
                    await db.flush()
                break  # savepoint committed — success
            except IntegrityError:
                if attempt < 2:
                    final_collectible = await pick_collectible(tier, user_id, db)
                    if not final_collectible:
                        break
                else:
                    logger.warning(
                        "award_reward: duplicate collision after 3 attempts for user %s tier %s",
                        user_id, tier,
                    )
                    final_collectible = None

    await db.flush()

    return RewardResult(
        tier=tier,
        points_awarded=points,
        collectible_type=final_collectible["reward_type"] if final_collectible else None,
        collectible_key=final_collectible["key"] if final_collectible else None,
        collectible_display_name=final_collectible["display_name"] if final_collectible else None,
        collectible_body=final_collectible.get("body") if final_collectible else None,
    )
