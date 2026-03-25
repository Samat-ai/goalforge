"""Shared utility helpers."""

from datetime import date, datetime
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
