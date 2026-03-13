from tests.conftest import create_test_goal


async def test_complete_milestone_activates_next(client):
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    # Milestones are ordered by position; first is active, rest are pending
    milestones = sorted(goal["milestones"], key=lambda m: m["position"])
    first_id = milestones[0]["id"]

    resp = await client.post(f"/goals/{goal_id}/milestones/{first_id}/complete")
    assert resp.status_code == 200

    updated = resp.json()
    updated_ms = sorted(updated["milestones"], key=lambda m: m["position"])

    assert updated_ms[0]["is_completed"] is True
    assert updated_ms[0]["sprint_status"] == "completed"
    assert updated_ms[1]["sprint_status"] == "active"


async def test_complete_milestone_already_completed_returns_400(client):
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    first_id = sorted(goal["milestones"], key=lambda m: m["position"])[0]["id"]

    await client.post(f"/goals/{goal_id}/milestones/{first_id}/complete")
    resp = await client.post(f"/goals/{goal_id}/milestones/{first_id}/complete")
    assert resp.status_code == 400
    assert "already completed" in resp.json()["detail"]


async def test_complete_all_milestones_makes_goal_achievable(client):
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    milestones = sorted(goal["milestones"], key=lambda m: m["position"])

    for ms in milestones:
        resp = await client.post(f"/goals/{goal_id}/milestones/{ms['id']}/complete")
        assert resp.status_code == 200

    final = resp.json()
    final_ms = sorted(final["milestones"], key=lambda m: m["position"])

    assert all(m["is_completed"] for m in final_ms)
    assert final["milestones_completed"] == final["milestones_total"]
