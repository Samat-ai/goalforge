"""Tests for the /api/jobs/trigger-reminders endpoint."""

import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models import DailyTask, NotificationLog, WebPushSubscription
from tests.conftest import TEST_USER_ID, create_test_goal


_TEST_JOBS_KEY = "test-jobs-key"
_JOBS_HEADERS = {"X-Api-Key": _TEST_JOBS_KEY}


async def test_trigger_reminders_sends_one_digest_per_user(client):
    """Endpoint sends one digest email per user, not per task."""
    goal = await create_test_goal(client)
    today_tasks = [t for t in goal["daily_tasks"] if t["assigned_date"] == str(date.today())]

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_reminder_digest", new=AsyncMock()) as mock_send,
    ):
        class _Now:
            hour = 9

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    # One user → one digest, regardless of task count
    assert resp.json()["digest_emails"] == 1
    assert resp.json()["rescue_emails"] == 0
    assert "push_notifications" in resp.json()
    assert mock_send.call_count == 1
    # The digest should contain all of today's tasks
    tasks_arg = mock_send.call_args.args[2]
    assert len(tasks_arg) == len(today_tasks)


async def test_trigger_reminders_skips_when_reminders_disabled(client, db_session):
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    settings_resp = await client.patch(
        f"/users/{TEST_USER_ID}/settings",
        json={"reminder_enabled": False},
    )
    assert settings_resp.status_code == 200

    # Add push subscription and qualifying streak-saver conditions
    yesterday = date.today() - timedelta(days=1)
    db_session.add(DailyTask(
        id=uuid.uuid4(),
        goal_id=uuid.UUID(goal_id),
        milestone_id=None,
        description="Yesterday task",
        tip="tip",
        assigned_date=yesterday,
        is_completed=True,
        completed_at=datetime.now(timezone.utc) - timedelta(hours=20),
    ))
    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/disabled-reminders",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_reminder_digest", new=AsyncMock()) as mock_send,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
    ):
        class _Now:
            hour = 19

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["digest_emails"] == 0
    assert data["streak_saver_pushes"] == 0
    assert data["inactivity_nudges"] == 0
    mock_send.assert_not_called()
    mock_push.assert_not_called()


async def test_trigger_reminders_skips_when_local_hour_does_not_match(client):
    await create_test_goal(client)
    settings_resp = await client.patch(
        f"/users/{TEST_USER_ID}/settings",
        json={"reminder_hour": 23},
    )
    assert settings_resp.status_code == 200

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_reminder_digest", new=AsyncMock()) as mock_send,
    ):
        class _Now:
            hour = 10

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        # reminder_hour was set to 23, mocked local hour is 10
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["digest_emails"] == 0
    mock_send.assert_not_called()


async def test_trigger_reminders_skips_completed_tasks(client):
    """Completed tasks are not included in the reminder digest."""
    goal = await create_test_goal(client)
    today_tasks = [t for t in goal["daily_tasks"] if t["assigned_date"] == str(date.today())]
    assert today_tasks, "Need at least one task today for this test"

    # Complete the first today task
    await client.patch(f"/tasks/{today_tasks[0]['id']}/complete")

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_reminder_digest", new=AsyncMock()) as mock_send,
    ):
        class _Now:
            hour = 9

        mock_user_now.return_value = _Now()
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
    data = resp.json()
    assert data["rescue_emails"] == 0
    assert data["digest_emails"] == 0
    assert data["push_notifications"] == 0
    assert data["streak_saver_pushes"] == 0
    assert data["inactivity_nudges"] == 0
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


@pytest.mark.asyncio
async def test_trigger_reminders_sends_rescue_email_when_in_rescue_mode(
    client, created_goal
):
    """When goal_is_rescue_mode returns True, send_rescue_email is called, not digest."""
    with patch("routes.jobs.settings") as mock_settings, \
         patch("routes.jobs.goal_is_rescue_mode", return_value=True) as mock_rescue_mode, \
         patch("routes.jobs.send_rescue_email", new=AsyncMock()) as mock_rescue_email, \
         patch("routes.jobs.send_reminder_digest", new=AsyncMock()) as mock_digest:
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post(
            "/api/jobs/trigger-reminders",
            headers={"X-Api-Key": _TEST_JOBS_KEY},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["rescue_emails"] == 1
    assert data["digest_emails"] == 0
    assert data["push_notifications"] == 0
    mock_rescue_email.assert_called_once()
    mock_digest.assert_not_called()


@pytest.mark.asyncio
async def test_streak_saver_fires_after_6pm_with_no_completion_today(client, db_session):
    """Streak-Saver sends push when: completed yesterday, not today, hour >= 18."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    yesterday = date.today() - timedelta(days=1)
    db_session.add(DailyTask(
        id=uuid.uuid4(),
        goal_id=uuid.UUID(goal_id),
        milestone_id=None,
        description="Yesterday task",
        tip="tip",
        assigned_date=yesterday,
        is_completed=True,
        completed_at=datetime.now(timezone.utc) - timedelta(hours=20),
    ))
    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/streak-test",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
    ):
        class _Now:
            hour = 19

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["streak_saver_pushes"] == 1
    assert data["digest_emails"] == 0
    assert data["inactivity_nudges"] == 0
    mock_push.assert_called_once()
    call_kwargs = mock_push.call_args.kwargs
    assert "streak" in call_kwargs["title"].lower() or "streak" in call_kwargs["body"].lower()


@pytest.mark.asyncio
async def test_streak_saver_sends_only_once_per_day(client, db_session):
    """Second cron run on the same local date does not re-send the push."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    yesterday = date.today() - timedelta(days=1)
    db_session.add(DailyTask(
        id=uuid.uuid4(),
        goal_id=uuid.UUID(goal_id),
        milestone_id=None,
        description="Yesterday task",
        tip="tip",
        assigned_date=yesterday,
        is_completed=True,
        completed_at=datetime.now(timezone.utc) - timedelta(hours=20),
    ))
    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/dedup-test",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
    ):
        class _Now:
            hour = 19

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY

        resp1 = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)
        resp2 = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp1.json()["streak_saver_pushes"] == 1
    assert resp2.json()["streak_saver_pushes"] == 0
    assert mock_push.call_count == 1


@pytest.mark.asyncio
async def test_streak_saver_does_not_fire_before_6pm(client, db_session):
    """Streak-Saver is silent before 6 PM local time."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    yesterday = date.today() - timedelta(days=1)
    db_session.add(DailyTask(
        id=uuid.uuid4(),
        goal_id=uuid.UUID(goal_id),
        milestone_id=None,
        description="Yesterday task",
        tip="tip",
        assigned_date=yesterday,
        is_completed=True,
        completed_at=datetime.now(timezone.utc) - timedelta(hours=20),
    ))
    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/before-6pm",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
    ):
        class _Now:
            hour = 17

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["streak_saver_pushes"] == 0
    mock_push.assert_not_called()


@pytest.mark.asyncio
async def test_streak_saver_does_not_fire_when_completed_today(client, db_session):
    """Streak-Saver is silent if the user has already completed a task today."""
    goal = await create_test_goal(client)
    today_tasks = [t for t in goal["daily_tasks"] if t["assigned_date"] == str(date.today())]
    assert today_tasks, "Need at least one task today"

    await client.patch(f"/tasks/{today_tasks[0]['id']}/complete")

    goal_id = goal["id"]
    yesterday = date.today() - timedelta(days=1)
    db_session.add(DailyTask(
        id=uuid.uuid4(),
        goal_id=uuid.UUID(goal_id),
        milestone_id=None,
        description="Yesterday task",
        tip="tip",
        assigned_date=yesterday,
        is_completed=True,
        completed_at=datetime.now(timezone.utc) - timedelta(hours=20),
    ))
    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/completed-today",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
    ):
        class _Now:
            hour = 19

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.json()["streak_saver_pushes"] == 0
    mock_push.assert_not_called()


@pytest.mark.asyncio
async def test_inactivity_nudge_fires_when_last_completion_was_30h_ago(client, db_session):
    """Inactivity Nudge fires when last completion was 24-48 hours ago."""
    from sqlalchemy import update as sql_update

    goal = await create_test_goal(client)
    today_tasks = [t for t in goal["daily_tasks"] if t["assigned_date"] == str(date.today())]
    assert today_tasks

    thirty_hours_ago = datetime.now(timezone.utc) - timedelta(hours=30)
    await db_session.execute(
        sql_update(DailyTask)
        .where(DailyTask.id == uuid.UUID(today_tasks[0]["id"]))
        .values(is_completed=True, completed_at=thirty_hours_ago)
    )
    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/inactivity-test",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
    ):
        class _Now:
            hour = 10

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["inactivity_nudges"] == 1
    assert data["streak_saver_pushes"] == 0
    assert data["digest_emails"] == 0
    mock_push.assert_called_once()
    call_kwargs = mock_push.call_args.kwargs
    assert "Companion" in call_kwargs["title"] or "misses" in call_kwargs["body"]


@pytest.mark.asyncio
async def test_inactivity_nudge_does_not_fire_when_churned_beyond_48h(client, db_session):
    """Users whose last completion was >48h ago are left alone (churned)."""
    from sqlalchemy import update as sql_update

    goal = await create_test_goal(client)
    today_tasks = [t for t in goal["daily_tasks"] if t["assigned_date"] == str(date.today())]
    assert today_tasks

    fifty_hours_ago = datetime.now(timezone.utc) - timedelta(hours=50)
    await db_session.execute(
        sql_update(DailyTask)
        .where(DailyTask.id == uuid.UUID(today_tasks[0]["id"]))
        .values(is_completed=True, completed_at=fifty_hours_ago)
    )
    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/churned-test",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
    ):
        class _Now:
            hour = 10

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.json()["inactivity_nudges"] == 0
    mock_push.assert_not_called()


@pytest.mark.asyncio
async def test_inactivity_nudge_does_not_fire_for_never_engaged_user(client, db_session):
    """Users who have never completed a task do not get the inactivity nudge."""
    await create_test_goal(client)

    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/never-engaged",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
    ):
        class _Now:
            hour = 10

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.json()["inactivity_nudges"] == 0
    mock_push.assert_not_called()


@pytest.mark.asyncio
async def test_streak_saver_overrides_regular_digest(client, db_session):
    """When streak-saver fires, the regular digest is skipped for that user."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    await client.patch(f"/users/{TEST_USER_ID}/settings", json={"reminder_hour": 18})

    yesterday = date.today() - timedelta(days=1)
    db_session.add(DailyTask(
        id=uuid.uuid4(),
        goal_id=uuid.UUID(goal_id),
        milestone_id=None,
        description="Yesterday task",
        tip="tip",
        assigned_date=yesterday,
        is_completed=True,
        completed_at=datetime.now(timezone.utc) - timedelta(hours=20),
    ))
    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/override-digest",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_reminder_digest", new=AsyncMock()) as mock_digest,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
    ):
        class _Now:
            hour = 18

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    data = resp.json()
    assert data["streak_saver_pushes"] == 1
    assert data["digest_emails"] == 0
    mock_digest.assert_not_called()
    mock_push.assert_called_once()


@pytest.mark.asyncio
async def test_triggers_do_not_fire_without_push_subscriptions(client, db_session):
    """Neither streak-saver nor inactivity nudge fires when user has no push subscriptions."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    # Set up qualifying conditions for streak-saver (completed yesterday, not today, hour >= 18)
    yesterday = date.today() - timedelta(days=1)
    db_session.add(DailyTask(
        id=uuid.uuid4(),
        goal_id=uuid.UUID(goal_id),
        milestone_id=None,
        description="Yesterday task",
        tip="tip",
        assigned_date=yesterday,
        is_completed=True,
        completed_at=datetime.now(timezone.utc) - timedelta(hours=20),
    ))
    await db_session.commit()
    # NOTE: No WebPushSubscription added

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
    ):
        class _Now:
            hour = 19

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["streak_saver_pushes"] == 0
    assert data["inactivity_nudges"] == 0
    mock_push.assert_not_called()


@pytest.mark.asyncio
async def test_streak_saver_takes_priority_over_inactivity_nudge(client, db_session):
    """When both triggers are eligible, streak-saver wins and inactivity nudge is skipped."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    # A task completed ~30h ago qualifies for BOTH:
    # - Inactivity nudge (24-48h window)
    # - Streak-saver: it was "yesterday" in terms of assigned_date, and today has no completion
    yesterday = date.today() - timedelta(days=1)
    thirty_hours_ago = datetime.now(timezone.utc) - timedelta(hours=30)
    db_session.add(DailyTask(
        id=uuid.uuid4(),
        goal_id=uuid.UUID(goal_id),
        milestone_id=None,
        description="Yesterday task completed 30h ago",
        tip="tip",
        assigned_date=yesterday,
        is_completed=True,
        completed_at=thirty_hours_ago,
    ))
    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/priority-test",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
    ):
        class _Now:
            hour = 19  # >= 18, so streak-saver is eligible

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    data = resp.json()
    assert data["streak_saver_pushes"] == 1
    assert data["inactivity_nudges"] == 0
    assert mock_push.call_count == 1  # only one push sent


# ---------------------------------------------------------------------------
# Sunday Star Log push notification tests
# ---------------------------------------------------------------------------

_SUNDAY = date(2026, 4, 5)   # weekday() == 6
_MONDAY = date(2026, 4, 6)   # weekday() == 0


def _make_mock_star_log(chapter_title="The Week of Breakthroughs", highlights=None):
    star_log = MagicMock()
    star_log.chapter_title = chapter_title
    star_log.highlights = highlights if highlights is not None else [
        "Completed 5 tasks",
        "3-day streak",
    ]
    return star_log


@pytest.mark.asyncio
async def test_sunday_star_log_push_fires_at_reminder_hour(client, db_session):
    """On Sunday at reminder_hour, the star log push is sent (not a regular digest)."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/star-log-test",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    mock_star_log = _make_mock_star_log()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.user_today", return_value=_SUNDAY),
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
        patch("routes.jobs.send_reminder_digest", new=AsyncMock()) as mock_digest,
        patch("routes.jobs.get_or_create_star_log", new=AsyncMock(return_value=mock_star_log)),
    ):
        class _Now:
            hour = 9  # matches default reminder_hour

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["star_log_pushes"] == 1
    assert data["digest_emails"] == 0
    mock_push.assert_called_once()
    call_kwargs = mock_push.call_args.kwargs
    assert "Star Log" in call_kwargs["title"]
    assert call_kwargs["url"] == "/stars"


@pytest.mark.asyncio
async def test_sunday_star_log_does_not_fire_at_wrong_hour(client, db_session):
    """On Sunday but at a different hour than reminder_hour, no star log push is sent."""
    await create_test_goal(client)

    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/star-log-wrong-hour",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.user_today", return_value=_SUNDAY),
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
        patch("routes.jobs.get_or_create_star_log", new=AsyncMock()) as mock_star_log_fn,
    ):
        class _Now:
            hour = 15  # user's reminder_hour is 9, so this does NOT match

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["star_log_pushes"] == 0
    assert data["digest_emails"] == 0
    mock_push.assert_not_called()
    mock_star_log_fn.assert_not_called()


@pytest.mark.asyncio
async def test_streak_saver_takes_priority_over_sunday_star_log(client, db_session):
    """On Sunday, streak-saver fires first and the star log branch is never reached."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    # Set reminder_hour to 19 so both streak-saver (>= 18) and star log (== reminder_hour)
    # would be eligible at hour 19 — but streak-saver wins in the priority chain.
    await client.patch(f"/users/{TEST_USER_ID}/settings", json={"reminder_hour": 19})

    # Add a completed task for yesterday
    yesterday = _SUNDAY - timedelta(days=1)
    db_session.add(DailyTask(
        id=uuid.uuid4(),
        goal_id=uuid.UUID(goal_id),
        milestone_id=None,
        description="Yesterday task",
        tip="tip",
        assigned_date=yesterday,
        is_completed=True,
        completed_at=datetime.now(timezone.utc) - timedelta(hours=20),
    ))
    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/streak-vs-star-log",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.user_today", return_value=_SUNDAY),
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
        patch("routes.jobs.get_or_create_star_log", new=AsyncMock()) as mock_star_log_fn,
    ):
        class _Now:
            hour = 19  # >= 18 (streak-saver) and == reminder_hour (star log)

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["streak_saver_pushes"] == 1
    assert data["star_log_pushes"] == 0
    mock_push.assert_called_once()
    mock_star_log_fn.assert_not_called()


@pytest.mark.asyncio
async def test_sunday_star_log_dedup_sends_only_once(client, db_session):
    """Second cron run on the same Sunday does not re-send the star log push."""
    await create_test_goal(client)

    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/star-log-dedup",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    mock_star_log = _make_mock_star_log()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.user_today", return_value=_SUNDAY),
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
        patch("routes.jobs.get_or_create_star_log", new=AsyncMock(return_value=mock_star_log)),
    ):
        class _Now:
            hour = 9

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY

        resp1 = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)
        resp2 = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp1.json()["star_log_pushes"] == 1
    assert resp2.json()["star_log_pushes"] == 0
    assert mock_push.call_count == 1


@pytest.mark.asyncio
async def test_non_sunday_sends_regular_digest_not_star_log(client, db_session):
    """On a non-Sunday weekday at reminder_hour, the regular digest fires (not the star log)."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    # Add a pending task explicitly on _MONDAY so the digest filter finds it
    # (tasks from create_test_goal use date.today(), but we mock user_today to _MONDAY)
    db_session.add(DailyTask(
        id=uuid.uuid4(),
        goal_id=uuid.UUID(goal_id),
        milestone_id=None,
        description="Monday pending task",
        tip="Get it done.",
        assigned_date=_MONDAY,
        is_completed=False,
    ))
    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/non-sunday-digest",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.user_today", return_value=_MONDAY),
        patch("routes.jobs.send_reminder_digest", new=AsyncMock()) as mock_digest,
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
        patch("routes.jobs.get_or_create_star_log", new=AsyncMock()) as mock_star_log_fn,
    ):
        class _Now:
            hour = 9  # matches default reminder_hour

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["star_log_pushes"] == 0
    assert data["digest_emails"] >= 1
    mock_star_log_fn.assert_not_called()


@pytest.mark.asyncio
async def test_sunday_star_log_fallback_body_when_no_highlights(client, db_session):
    """Star log push is still sent when the star log has no highlights; body contains chapter title."""
    await create_test_goal(client)

    db_session.add(WebPushSubscription(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        endpoint="https://push.example.com/star-log-fallback",
        p256dh="dGVzdA==",
        auth="dGVzdA==",
        is_active=True,
    ))
    await db_session.commit()

    mock_star_log = _make_mock_star_log(
        chapter_title="Quiet Orbit",
        highlights=["No completed tasks in this window"],
    )

    with (
        patch("routes.jobs.settings") as mock_settings,
        patch("routes.jobs.user_now") as mock_user_now,
        patch("routes.jobs.user_today", return_value=_SUNDAY),
        patch("routes.jobs.send_push_digest", new=AsyncMock()) as mock_push,
        patch("routes.jobs.get_or_create_star_log", new=AsyncMock(return_value=mock_star_log)),
    ):
        class _Now:
            hour = 9

        mock_user_now.return_value = _Now()
        mock_settings.jobs_api_key = _TEST_JOBS_KEY
        resp = await client.post("/api/jobs/trigger-reminders", headers=_JOBS_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["star_log_pushes"] == 1
    mock_push.assert_called_once()
    call_kwargs = mock_push.call_args.kwargs
    assert "Quiet Orbit" in call_kwargs["body"]
