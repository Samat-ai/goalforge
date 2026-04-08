"""
Middleware that attaches the authenticated user_id to request.state
so the rate limiter can use per-user keys instead of per-IP keys.

This is a best-effort extraction — it decodes the JWT without full verification
(verification happens in the route dependency). If extraction fails, the rate
limiter falls back to IP-based keying.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import logging

logger = logging.getLogger(__name__)


class UserIdMiddleware(BaseHTTPMiddleware):
    """Attach user_id from JWT to request.state for per-user rate limiting."""

    async def dispatch(self, request: Request, call_next):
        request.state.user_id = None
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            try:
                import jwt  # PyJWT, already a dependency via python-jose or directly
                token = auth[7:]
                # Decode without verification — just need the sub claim for rate limiting
                payload = jwt.decode(token, options={"verify_signature": False})
                request.state.user_id = payload.get("sub")
            except Exception:
                pass  # Fall back to IP-based rate limiting silently
        return await call_next(request)
