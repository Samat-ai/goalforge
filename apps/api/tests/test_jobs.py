"""Tests for the /api/jobs/trigger-reminders endpoint."""

from datetime import date
from unittest.mock import AsyncMock, patch

import pytest

from tests.conftest import TEST_USER_ID, create_test_goal


_TEST_JOBS_KEY = "test-jobs-key"
_JOBS_HEADERS = {"X-Api-Key": _TEST_JOBS_KEY}


async def test_trigger_reminders_sends_one_digest_per_user(client):
    """Endpoint sends one digest email per user, not per task."""
    goal = await create_test_goal(client)
    today_tasks = [t for t in goal["daily_tasks"] if t["assigned_date"] == str(date.today())]

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.send_reminder_digest", new=AsyncMock()) as mock_send,
    ):
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    # One user → one digest, regardless of task count
    assert resp.json()["digest_emails"] == 1
    assert resp.json()["rescue_emails"] == 0
    assert mock_send.call_count == 1
    # The digest should contain all of today's tasks
    tasks_arg = mock_send.call_args.args[2]
    assert len(tasks_arg) == len(today_tasks)


async def test_trigger_reminders_skips_completed_tasks(client):
    """Completed tasks are not included in the reminder digest."""
    goal = await create_test_goal(client)
    today_tasks = [t for t in goal["daily_tasks"] if t["assigned_date"] == str(date.today())]
    assert today_tasks, "Need at least one task today for this test"

    # Complete the first today task
    await client.patch(f"/tasks/{today_tasks[0]['id']}/complete")

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.send_reminder_digest", new=AsyncMock()) as mock_send,
    ):
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    if len(today_tasks) == 1:
        # All tasks completed → no digest sent
        assert resp.json()["digest_emails"] == 0
        mock_send.assert_not_called()
    else:
        assert resp.json()["digest_emails"] == 1
        tasks_arg = mock_send.call_args.args[2]
        assert len(tasks_arg) == len(today_tasks) - 1


async def test_trigger_reminders_no_tasks_today(client):
    """Returns 0 when there are no pending tasks today."""
    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.send_reminder_digest", new=AsyncMock()) as mock_send,
    ):
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    assert resp.json() == {"rescue_emails": 0, "digest_emails": 0}
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
        patch("routes.jobs.send_reminder_digest", new=AsyncMock()),
    ):
        mock_settings.jobs_api_key = "secret-key"
        resp = await client.post(
            "/api/jobs/trigger-reminders",
            headers={"X-Api-Key": "secret-key"},
        )

    assert resp.status_code == 200
