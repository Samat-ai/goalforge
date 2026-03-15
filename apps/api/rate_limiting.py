"""Rate-limiting configuration shared across route modules."""

from fastapi import Request
from slowapi.util import get_remote_address

from config import settings

# Expose app-level setup values so main.py can wire up the middleware/handler.
rate_limit_enabled = settings.rate_limit_enabled


def _user_key(request: Request) -> str:
    """Rate-limit key: Clerk user_id from path params, fall back to IP."""
    return request.path_params.get("user_id") or get_remote_address(request)


if settings.rate_limit_enabled:
    from slowapi import Limiter

    limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

    def rate_limit(limit_str: str, key_func=None):
        kwargs = {"key_func": key_func} if key_func else {}
        return limiter.limit(limit_str, **kwargs)
else:
    limiter = None  # type: ignore[assignment]

    def rate_limit(limit_str: str, key_func=None):  # type: ignore[misc]
        def decorator(func):
            return func
        return decorator
