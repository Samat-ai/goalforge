"""Shared utility helpers."""

from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def user_today(timezone_str: str) -> date:
    """Return today's calendar date in the user's local timezone."""
    try:
        tz = ZoneInfo(timezone_str)
    except (ZoneInfoNotFoundError, KeyError):
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()
