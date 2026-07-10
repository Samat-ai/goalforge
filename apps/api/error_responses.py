"""Standardized HTTP error response helpers.

All helpers return an HTTPException whose ``detail`` is a dict that conforms
to the canonical API error shape::

    {
        "error": {
            "code": "<snake_case_code>",
            "message": "<human-readable text>",
            "status": <http_status_int>
        }
    }

The global ``http_exception_handler`` in ``main.py`` wraps the ``detail``
under the ``"error"`` key automatically, so callers only need to raise the
returned exception.
"""

from fastapi import HTTPException


def not_found(resource: str) -> HTTPException:
    return HTTPException(
        404,
        detail={"code": "not_found", "message": f"{resource} not found", "status": 404},
    )


def forbidden(message: str = "Access denied") -> HTTPException:
    return HTTPException(
        403,
        detail={"code": "forbidden", "message": message, "status": 403},
    )


def bad_request(message: str) -> HTTPException:
    return HTTPException(
        400,
        detail={"code": "bad_request", "message": message, "status": 400},
    )


def conflict(message: str) -> HTTPException:
    return HTTPException(
        409,
        detail={"code": "conflict", "message": message, "status": 409},
    )


def pro_required(feature: str) -> HTTPException:
    return HTTPException(
        402,
        detail={
            "code": "pro_required",
            "feature": feature,
            "message": f"{feature} requires Pro plan",
            "upgrade_url": "/billing",
            "status": 402,
        },
    )


def service_unavailable(message: str = "Service temporarily unavailable") -> HTTPException:
    return HTTPException(
        503,
        detail={"code": "service_unavailable", "message": message, "status": 503},
    )
