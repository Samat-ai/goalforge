"""Shared utility helpers."""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def user_today(timezone_str: str) -> date:
    """Return today's calendar date in the user's local timezone."""
    try:
        tz = ZoneInfo(timezone_str or "UTC")
    except (ZoneInfoNotFoundError, KeyError, TypeError):
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()


def user_now(timezone_str: str) -> datetime:
    """Return current datetime in the user's local timezone."""
    try:
        tz = ZoneInfo(timezone_str or "UTC")
    except (ZoneInfoNotFoundError, KeyError, TypeError):
        tz = ZoneInfo("UTC")
    return datetime.now(tz)


def next_local_midnight_utc(timezone_str: str) -> datetime:
    """Next midnight in the user's timezone, as a UTC instant.

    Anything bucketed per user-local day (coach cap, reminders dedup)
    effectively resets at this moment.
    """
    try:
        tz = ZoneInfo(timezone_str or "UTC")
    except (ZoneInfoNotFoundError, KeyError, TypeError):
        tz = ZoneInfo("UTC")
    tomorrow = datetime.now(tz).date() + timedelta(days=1)
    return datetime.combine(tomorrow, time.min, tzinfo=tz).astimezone(timezone.utc)
