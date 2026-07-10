"""Shared utility helpers."""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def get_user_tz(timezone_str: str) -> ZoneInfo:
    """Safely parse a timezone string, falling back to UTC on invalid input."""
    try:
        return ZoneInfo(timezone_str)
    except (ZoneInfoNotFoundError, KeyError):
        return ZoneInfo("UTC")


def user_now(timezone_str: str) -> datetime:
    """Current datetime in the user's local timezone."""
    return datetime.now(get_user_tz(timezone_str))


def user_today(timezone_str: str) -> date:
    """Current calendar date in the user's local timezone."""
    return user_now(timezone_str).date()


def user_start_of_day(timezone_str: str) -> datetime:
    """Midnight at the start of today in the user's timezone, as a tz-aware datetime."""
    tz = get_user_tz(timezone_str)
    today = user_today(timezone_str)
    return datetime(today.year, today.month, today.day, tzinfo=tz)


def utc_now() -> datetime:
    """Current UTC datetime (always timezone-aware)."""
    return datetime.now(timezone.utc)


def to_user_tz(dt: datetime, timezone_str: str) -> datetime:
    """Convert any aware datetime to the user's local timezone."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(get_user_tz(timezone_str))


def days_since(dt: datetime | None, timezone_str: str = "UTC") -> float | None:
    """
    Hours elapsed since a datetime in the user's timezone context, divided by 24.
    Returns None if dt is None.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (utc_now() - dt).total_seconds() / 86400
