"""
FastAPI JWT authentication dependencies backed by Clerk's JWKS endpoint.

Dependency tree (FastAPI caches _decode_token per request):

    _decode_token  →  get_current_user_id   (str)  used by every protected route
                   →  get_current_user_email (str)  used only by create_goal
"""

import asyncio
import httpx
import jwt
from cachetools import TTLCache
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings

# ---------------------------------------------------------------------------
# JWKS cache — refreshed every 10 minutes so key rotations propagate quickly
# ---------------------------------------------------------------------------

_jwks_cache: TTLCache = TTLCache(maxsize=2, ttl=600)
_jwks_lock = asyncio.Lock()
_bearer = HTTPBearer()


async def _get_jwks() -> dict:
    """Fetch Clerk's public JWKS, returning the cached copy when fresh."""
    if "jwks" in _jwks_cache:
        return _jwks_cache["jwks"]
    async with _jwks_lock:
        # Double-check after acquiring lock — another coroutine may have populated it
        if "jwks" in _jwks_cache:
            return _jwks_cache["jwks"]
        if not settings.clerk_jwks_url:
            raise RuntimeError("CLERK_JWKS_URL is not configured")
        async with httpx.AsyncClient() as client:
            response = await client.get(settings.clerk_jwks_url, timeout=10)
            response.raise_for_status()
            jwks = response.json()
        _jwks_cache["jwks"] = jwks
        return jwks


# ---------------------------------------------------------------------------
# Core decode dependency
# ---------------------------------------------------------------------------

async def _decode_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """Verify the Bearer JWT and return the decoded payload."""
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
    except Exception:
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
    """Return the email claim from the JWT, or '' if absent."""
    return payload.get("email", "")
