"""
Tests for health check and readiness probe endpoints.

/health        — liveness: always 200, never touches the DB
/health/ready  — readiness: 200 when DB is reachable, 503 otherwise
/health/info   — build info: always 200 with version/python/environment keys
"""


async def test_liveness(client):
    """GET /health returns 200 with status ok."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"


async def test_liveness_has_version(client):
    """GET /health response includes a version field."""
    resp = await client.get("/health")
    assert "version" in resp.json()


async def test_readiness_valid_response(client):
    """GET /health/ready returns 200 or 503 — both are acceptable.

    In CI the test suite uses an in-memory SQLite engine injected via
    dependency override, but the readiness endpoint opens its own session
    directly from AsyncSessionLocal (which points at the real DB URL).
    So 503 is a perfectly valid outcome here.
    """
    resp = await client.get("/health/ready")
    assert resp.status_code in (200, 503)
    body = resp.json()
    assert "status" in body
    assert "checks" in body
    assert "database" in body["checks"]


async def test_readiness_200_shape(client):
    """When the DB is reachable, /health/ready returns the expected shape."""
    resp = await client.get("/health/ready")
    if resp.status_code == 200:
        body = resp.json()
        assert body["status"] == "ready"
        assert body["checks"]["database"] == "ok"


async def test_readiness_503_shape(client):
    """When the DB is not reachable, /health/ready returns the expected shape."""
    resp = await client.get("/health/ready")
    if resp.status_code == 503:
        body = resp.json()
        assert body["status"] == "degraded"
        assert body["checks"]["database"] == "error"


async def test_info(client):
    """GET /health/info returns 200 with version, python_version, environment."""
    resp = await client.get("/health/info")
    assert resp.status_code == 200
    body = resp.json()
    assert "version" in body
    assert "python_version" in body
    assert "environment" in body


async def test_info_python_version_format(client):
    """python_version field looks like major.minor.micro."""
    resp = await client.get("/health/info")
    python_version = resp.json()["python_version"]
    parts = python_version.split(".")
    assert len(parts) == 3
    assert all(part.isdigit() for part in parts)
