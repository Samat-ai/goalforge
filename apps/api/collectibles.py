"""
Collectible registry for GoalForge's loot/reward system.
To add new collectibles: add entries to THEMES, TITLES, or LORE below.
No service code changes required.
"""
from dataclasses import dataclass
from typing import Literal

RewardType = Literal["theme", "title", "lore"]
LootTier = Literal["standard", "bonus", "crit", "jackpot"]


@dataclass(frozen=True)
class Collectible:
    key: str
    reward_type: RewardType
    display_name: str
    description: str
    rarity: str  # "common", "uncommon", "rare", "legendary"
    eligible_tiers: tuple[LootTier, ...]  # which loot tiers can drop this


# ── Themes ──────────────────────────────────────────────────────────────────
THEMES: list[Collectible] = [
    Collectible(
        key="neon_cyberpunk",
        reward_type="theme",
        display_name="Neon Cyberpunk",
        description="Electric blues and magentas in a dark digital city.",
        rarity="legendary",
        eligible_tiers=("jackpot",),
    ),
    Collectible(
        key="matcha_green",
        reward_type="theme",
        display_name="Matcha Green",
        description="Calm, focused. Earthy greens for deep work sessions.",
        rarity="rare",
        eligible_tiers=("jackpot",),
    ),
    Collectible(
        key="midnight_ocean",
        reward_type="theme",
        display_name="Midnight Ocean",
        description="Deep navy and silver. Peaceful like the sea at night.",
        rarity="rare",
        eligible_tiers=("jackpot",),
    ),
    Collectible(
        key="sunset_ember",
        reward_type="theme",
        display_name="Sunset Ember",
        description="Warm oranges and reds. Burn like you mean it.",
        rarity="legendary",
        eligible_tiers=("jackpot",),
    ),
]

# ── Titles ───────────────────────────────────────────────────────────────────
TITLES: list[Collectible] = [
    Collectible(
        key="the_relentless",
        reward_type="title",
        display_name="The Relentless",
        description="Never stopped. Not once.",
        rarity="uncommon",
        eligible_tiers=("jackpot",),
    ),
    Collectible(
        key="streak_survivor",
        reward_type="title",
        display_name="Streak Survivor",
        description="You kept the chain alive.",
        rarity="common",
        eligible_tiers=("jackpot", "bonus"),
    ),
    Collectible(
        key="comeback_kid",
        reward_type="title",
        display_name="Comeback Kid",
        description="Fell down. Got back up. Simple as that.",
        rarity="common",
        eligible_tiers=("jackpot", "bonus"),
    ),
    Collectible(
        key="night_owl",
        reward_type="title",
        display_name="Night Owl",
        description="The midnight hours belong to you.",
        rarity="common",
        eligible_tiers=("jackpot", "bonus"),
    ),
    Collectible(
        key="early_riser",
        reward_type="title",
        display_name="Early Riser",
        description="You won the morning before the world woke up.",
        rarity="common",
        eligible_tiers=("jackpot", "bonus"),
    ),
    Collectible(
        key="the_consistent",
        reward_type="title",
        display_name="The Consistent",
        description="Day after day. No drama, just results.",
        rarity="uncommon",
        eligible_tiers=("jackpot",),
    ),
    Collectible(
        key="momentum_builder",
        reward_type="title",
        display_name="Momentum Builder",
        description="Each day adds to the last. The snowball grows.",
        rarity="common",
        eligible_tiers=("jackpot", "bonus"),
    ),
    Collectible(
        key="habit_forger",
        reward_type="title",
        display_name="Habit Forger",
        description="You don't have goals. You have systems.",
        rarity="uncommon",
        eligible_tiers=("jackpot",),
    ),
    Collectible(
        key="deep_focus",
        reward_type="title",
        display_name="Deep Focus",
        description="Distraction is a choice you stopped making.",
        rarity="uncommon",
        eligible_tiers=("jackpot",),
    ),
    Collectible(
        key="the_persistent",
        reward_type="title",
        display_name="The Persistent",
        description="Obstacles slow others. You just keep moving.",
        rarity="uncommon",
        eligible_tiers=("jackpot",),
    ),
    Collectible(
        key="rising_star",
        reward_type="title",
        display_name="Rising Star",
        description="Still climbing. The peak is just the beginning.",
        rarity="common",
        eligible_tiers=("jackpot", "bonus"),
    ),
    Collectible(
        key="unstoppable",
        reward_type="title",
        display_name="Unstoppable",
        description="They said it couldn't be done. You didn't hear them.",
        rarity="legendary",
        eligible_tiers=("jackpot",),
    ),
]

# ── Lore ─────────────────────────────────────────────────────────────────────
LORE: list[Collectible] = [
    Collectible(
        key="lore_speck",
        reward_type="lore",
        display_name="The Speck Awakens",
        description=(
            "In the beginning there was only potential — a single point of light no larger "
            "than a dust mote. Yet within it stirred the first whisper of ambition. The Speck "
            "did not know what it would become, only that it must move."
        ),
        rarity="common",
        eligible_tiers=("crit",),
    ),
    Collectible(
        key="lore_ember",
        reward_type="lore",
        display_name="The Ember's Oath",
        description=(
            "When the Speck first caught the heat of consistent effort, it became an Ember. "
            "Embers are fragile, but they remember the cold. Every small action fed the glow "
            "until darkness itself learned to step aside."
        ),
        rarity="common",
        eligible_tiers=("crit",),
    ),
    Collectible(
        key="lore_flare",
        reward_type="lore",
        display_name="The Flare Ignites",
        description=(
            "A Flare is born in the moment discipline becomes instinct. What once required "
            "willpower now simply happens. The Flare does not fight the day — it illuminates it."
        ),
        rarity="uncommon",
        eligible_tiers=("crit",),
    ),
    Collectible(
        key="lore_luminary",
        reward_type="lore",
        display_name="The Luminary Rises",
        description=(
            "Luminaries are visible from a distance. Not because they seek attention, but "
            "because sustained effort radiates outward. Others begin to orbit their momentum."
        ),
        rarity="uncommon",
        eligible_tiers=("crit",),
    ),
    Collectible(
        key="lore_nova",
        reward_type="lore",
        display_name="The Nova Expands",
        description=(
            "The Nova stage marks the moment a goal-seeker stops becoming and starts being. "
            "The energy no longer comes from outside — it generates itself. A Nova does not "
            "burn out. It expands."
        ),
        rarity="rare",
        eligible_tiers=("crit",),
    ),
    Collectible(
        key="lore_celestial",
        reward_type="lore",
        display_name="The Celestial Endures",
        description=(
            "Celestials are those who have proven that consistency is not a phase but a nature. "
            "They have forgotten what it feels like to quit, because quitting requires imagining "
            "a self that is less than what they have already become."
        ),
        rarity="legendary",
        eligible_tiers=("crit",),
    ),
]

# ── Registry ──────────────────────────────────────────────────────────────────
ALL_COLLECTIBLES: list[Collectible] = THEMES + TITLES + LORE

# Lookup maps
BY_KEY: dict[str, Collectible] = {c.key: c for c in ALL_COLLECTIBLES}
BY_TYPE: dict[RewardType, list[Collectible]] = {
    "theme": THEMES,
    "title": TITLES,
    "lore": LORE,
}
BY_TIER: dict[LootTier, list[Collectible]] = {
    tier: [c for c in ALL_COLLECTIBLES if tier in c.eligible_tiers]
    for tier in ("standard", "bonus", "crit", "jackpot")
}


def get_collectible(key: str) -> Collectible | None:
    """Look up a collectible by its unique key."""
    return BY_KEY.get(key)


def get_eligible_for_tier(tier: LootTier, reward_type: RewardType | None = None) -> list[Collectible]:
    """Return collectibles eligible for the given loot tier, optionally filtered by type."""
    eligible = BY_TIER.get(tier, [])
    if reward_type:
        eligible = [c for c in eligible if c.reward_type == reward_type]
    return eligible


def get_eligible_collectibles(tier: LootTier, reward_type: RewardType | None = None) -> list[Collectible]:
    """Alias for get_eligible_for_tier — used by reward_service.pick_collectible."""
    return get_eligible_for_tier(tier, reward_type)
