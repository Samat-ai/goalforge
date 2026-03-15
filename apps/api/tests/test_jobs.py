"""Tests for the /api/jobs/trigger-reminders endpoint."""

from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from tests.conftest import TEST_USER_ID, create_test_goal


async def test_trigger_reminders_counts_todays_pending_tasks(client):
    """Endpoint returns count of today's pending tasks."""
    goal = await create_test_goal(client)
    today_tasks = [t for t in goal["daily_tasks"] if t["assigned_date"] == str(date.today())]

    with patch("routes.jobs.send_reminder_email", new=AsyncMock()) as mock_send:
        resp = await client.post("/api/jobs/trigger-reminders")

    assert resp.status_code == 200
    assert resp.json()["sent"] == len(today_tasks)
    assert mock_send.call_count == len(today_tasks)


async def test_trigger_reminders_skips_completed_tasks(client):
    """Completed tasks are not included in the reminder batch."""
    goal = await create_test_goal(client)
    today_tasks = [t for t in goal["daily_tasks"] if t["assigned_date"] == str(date.today())]
    assert today_tasks, "Need at least one task today for this test"

    # Complete the first today task
    await client.patch(f"/tasks/{today_tasks[0]['id']}/complete")

    with patch("routes.jobs.send_reminder_email", new=AsyncMock()) as mock_send:
        resp = await client.post("/api/jobs/trigger-reminders")

    assert resp.status_code == 200
    assert resp.json()["sent"] == len(today_tasks) - 1
    assert mock_send.call_count == len(today_tasks) - 1


async def test_trigger_reminders_no_tasks_today(client):
    """Returns 0 when there are no pending tasks today."""
    with patch("routes.jobs.send_reminder_email", new=AsyncMock()) as mock_send:
        resp = await client.post("/api/jobs/trigger-reminders")

    assert resp.status_code == 200
    assert resp.json() == {"sent": 0}
    mock_send.assert_not_called()


async def test_trigger_reminders_api_key_enforced(client):
    """Returns 401 when jobs_api_key is set but header is missing."""
    with patch("routes.jobs.settings") as mock_settings:
        mock_settings.jobs_api_key = "secret-key"
        resp = await client.post("/api/jobs/trigger-reminders")

    assert resp.status_code == 401


async def test_trigger_reminders_api_key_accepted(client):
    """Returns 200 when correct X-Api-Key header is provided."""
    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.send_reminder_email", new=AsyncMock()),
    ):
        mock_settings.jobs_api_key = "secret-key"
        resp = await client.post(
            "/api/jobs/trigger-reminders",
            headers={"X-Api-Key": "secret-key"},
        )

    assert resp.status_code == 200
