from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from tests.conftest import TEST_USER_ID, utc_today
from schemas import AICoachTurnOutput, AIGoalOutput, AIMilestoneConfig, AITaskOutput


def _mock_goal_output() -> AIGoalOutput:
    today = utc_today()
    return AIGoalOutput(
        smart_title="Launch a weekly writing habit",
        smart_description="Write and publish one high-quality article each week for 12 weeks.",
        goal_type="career",
        target_date=today + timedelta(days=84),
        milestones=[
            AIMilestoneConfig(title="Clarity Sprint", sprint_theme="Define topic and voice", is_final=False),
            AIMilestoneConfig(title="Draft Sprint", sprint_theme="Produce first solid drafts", is_final=False),
            AIMilestoneConfig(title="Publish Sprint", sprint_theme="Ship weekly outputs", is_final=True),
        ],
        initial_tasks=[
            AITaskOutput(
                description=f"Task {i + 1}",
                tip="Keep it focused.",
                assigned_date=today + timedelta(days=i),
            )
            for i in range(7)
        ],
    )


@pytest.mark.asyncio
async def test_start_coach_session_returns_initial_question(client):
    response = await client.post(f"/users/{TEST_USER_ID}/coach/sessions/start")

    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == TEST_USER_ID
    assert data["is_completed"] is False
    assert data["stage"] == 0
    assert len(data["messages"]) == 1
    assert data["messages"][0]["role"] == "coach"


@pytest.mark.asyncio
async def test_coach_session_forges_goal_after_five_answers(client):
    start = await client.post(f"/users/{TEST_USER_ID}/coach/sessions/start")
    assert start.status_code == 201
    session_id = start.json()["id"]

    with (
        patch(
            "routes.coach.generate_coach_turn",
            new=AsyncMock(return_value=AICoachTurnOutput(acknowledgement="Great signal. Let's sharpen this.")),
        ),
        patch(
            "routes.coach.generate_smart_goal",
            new=AsyncMock(return_value=_mock_goal_output()),
        ),
    ):
        for i in range(5):
            send = await client.post(
                f"/coach/sessions/{session_id}/messages",
                json={"content": f"Answer {i + 1}"},
            )
            assert send.status_code == 200
            payload = send.json()

            if i < 4:
                assert payload["session"]["is_completed"] is False
                assert payload["forged_goal"] is None
            else:
                assert payload["session"]["is_completed"] is True
                assert payload["forged_goal"] is not None
                assert payload["forged_goal"]["smart_title"] == "Launch a weekly writing habit"

    goals_resp = await client.get(f"/users/{TEST_USER_ID}/goals?limit=20&offset=0")
    assert goals_resp.status_code == 200
    items = goals_resp.json()["items"]
    assert any(goal["smart_title"] == "Launch a weekly writing habit" for goal in items)
