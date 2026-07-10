"""Shared utility helpers."""

import base64
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


def encode_cursor(value: str) -> str:
    """Base64-encode a cursor value (any string, e.g. an ISO timestamp or UUID)."""
    return base64.urlsafe_b64encode(value.encode()).decode()


def decode_cursor(cursor: str) -> str:
    """Base64-decode a cursor back to its original string value."""
    return base64.urlsafe_b64decode(cursor.encode()).decode()
