"""
Rate limiting for GoalForge API.
Uses Redis storage in production for distributed rate limiting across instances.
Falls back to in-memory storage if Redis is unavailable (safe for development).
"""
import logging
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)


def _get_user_id_key(request) -> str:
    """Rate limit by authenticated user ID. Falls back to IP if no user."""
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return get_remote_address(request)


def create_limiter(redis_url: str | None = None) -> Limiter:
    """
    Create a rate limiter with Redis storage if available, else memory.

    Args:
        redis_url: Redis connection URL. If None or empty, uses in-memory storage.

    Returns:
        Configured Limiter instance.
    """
    if redis_url:
        try:
            # Test the connection is reachable before committing to Redis storage
            import redis as redis_client
            r = redis_client.from_url(redis_url, socket_connect_timeout=2)
            r.ping()
            storage_uri = redis_url
            logger.info("Rate limiter: using Redis storage at %s", redis_url.split("@")[-1])
        except Exception as e:
            storage_uri = "memory://"
            logger.warning("Rate limiter: Redis unavailable (%s), falling back to memory", e)
    else:
        storage_uri = "memory://"
        logger.info("Rate limiter: using in-memory storage (not suitable for multi-instance)")

    return Limiter(
        key_func=_get_user_id_key,
        storage_uri=storage_uri,
    )


# Per-IP key function (for endpoints where user isn't authenticated)
get_ip_key = get_remote_address

# Per-user key function (for authenticated endpoints)
get_user_key = _get_user_id_key
