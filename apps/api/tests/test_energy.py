"""Integration tests for energy resize endpoints."""

import pytest

from tests.conftest import TEST_USER_ID, create_test_goal


async def test_schema_has_original_fields(client):
    """TaskResponse includes original_description and original_tip (both None by default)."""
    goal = await create_test_goal(client)
    task = goal["daily_tasks"][0]
    assert "original_description" in task
    assert task["original_description"] is None
    assert "original_tip" in task
    assert task["original_tip"] is None
