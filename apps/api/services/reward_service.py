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

from collectibles import BY_KEY, BY_TIER, get_eligible_collectibles
from models import DailyTask, Goal, Reward, User

logger = logging.getLogger(__name__)


def get_collectible_info(reward_key: str) -> dict | None:
    """Look up display_name and body for a reward_key. Returns None if not in registry."""
    c = BY_KEY.get(reward_key)
    if c is None:
        return None
    return {
        "key": c.key,
        "reward_type": c.reward_type,
        "display_name": c.display_name,
        "body": c.description if c.reward_type == "lore" else None,
    }


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
    eligible = get_eligible_collectibles(tier)  # type: ignore[arg-type]
    if not eligible:
        return None

    # Group by reward_type and shuffle the type order for fairness
    type_groups: dict[str, list] = {}
    for c in eligible:
        type_groups.setdefault(c.reward_type, []).append(c)

    ctypes = list(type_groups.keys())
    random.shuffle(ctypes)

    for ctype in ctypes:
        owned_result = await db.execute(
            select(Reward.reward_key).where(
                Reward.user_id == user_id,
                Reward.reward_type == ctype,
            )
        )
        owned_keys = {row[0] for row in owned_result.all()}

        available = [c for c in type_groups[ctype] if c.key not in owned_keys]
        if available:
            chosen = random.choice(available)
            return {
                "reward_type": chosen.reward_type,
                "key": chosen.key,
                "display_name": chosen.display_name,
                "body": chosen.description if chosen.reward_type == "lore" else None,
            }

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
    collectible_rarity: str | None = None


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

    rarity: str | None = None
    if final_collectible:
        c = BY_KEY.get(final_collectible["key"])
        rarity = c.rarity if c else None

    return RewardResult(
        tier=tier,
        points_awarded=points,
        collectible_type=final_collectible["reward_type"] if final_collectible else None,
        collectible_key=final_collectible["key"] if final_collectible else None,
        collectible_display_name=final_collectible["display_name"] if final_collectible else None,
        collectible_body=final_collectible.get("body") if final_collectible else None,
        collectible_rarity=rarity,
    )
