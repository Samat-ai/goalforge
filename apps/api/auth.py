"""
FastAPI JWT authentication dependencies backed by Clerk's JWKS endpoint.

Dependency tree (FastAPI caches _decode_token per request):

    _decode_token  →  get_current_user_id   (str)  used by every protected route
                   →  get_current_user_email (str)  used only by create_goal
"""

import asyncio
import logging
import httpx
import jwt
from cachetools import TTLCache
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# JWKS cache — refreshed every 10 minutes so key rotations propagate quickly
# ---------------------------------------------------------------------------

_jwks_cache: TTLCache = TTLCache(maxsize=2, ttl=600)
_jwks_lock = asyncio.Lock()
_bearer = HTTPBearer(auto_error=False)


def _allowed_origins() -> set[str]:
    """Origins allowed as the JWT `azp` claim — same list CORS trusts."""
    return {o.strip() for o in settings.cors_origins.split(",") if o.strip()}


async def _get_jwks() -> dict:
    """Fetch Clerk's public JWKS, returning the cached copy when fresh."""
    if "jwks" in _jwks_cache:
        return _jwks_cache["jwks"]
    async with _jwks_lock:
        # Double-check after acquiring lock — another coroutine may have populated it
        if "jwks" in _jwks_cache:
            return _jwks_cache["jwks"]
        if not settings.clerk_jwks_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Auth configuration missing",
            )
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(settings.clerk_jwks_url, timeout=10)
                response.raise_for_status()
                jwks = response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Auth service unavailable",
            ) from exc
        _jwks_cache["jwks"] = jwks
        return jwks


# ---------------------------------------------------------------------------
# Core decode dependency
# ---------------------------------------------------------------------------

async def _decode_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Verify the Bearer JWT and return the decoded payload."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")

        public_key = await _find_public_key(kid)
        if public_key is None:
            # Key not in cache — may be a fresh rotation; evict and retry once
            _jwks_cache.pop("jwks", None)
            public_key = await _find_public_key(kid)

        if public_key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: signing key not found",
            )

        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk tokens have no fixed audience
        )

        # Clerk sets `azp` (authorized party) to the origin that requested the
        # token — reject tokens minted for an origin we don't serve.
        azp = payload.get("azp")
        if azp and azp not in _allowed_origins():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: unrecognized authorized party",
            )
        return payload

    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )
    except Exception as exc:
        logger.error("Unexpected error validating token: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


async def _find_public_key(kid: str | None):
    """Look up the RSA public key matching `kid` in the JWKS."""
    jwks = await _get_jwks()
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
    return None


# ---------------------------------------------------------------------------
# Public dependencies
# ---------------------------------------------------------------------------

async def get_current_user_id(payload: dict = Depends(_decode_token)) -> str:
    """Return the Clerk user_id (sub claim) from the verified JWT."""
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing sub claim",
        )
    return sub


async def get_current_user_email(payload: dict = Depends(_decode_token)) -> str:
    """Return the email claim from the JWT.

    Falls back to a unique placeholder derived from the sub claim to avoid
    violating the User.email unique constraint when email is not in the token.
    """
    email = payload.get("email")
    if email:
        return email
    sub = payload.get("sub", "unknown")
    return f"{sub}@placeholder.goalforge.app"
