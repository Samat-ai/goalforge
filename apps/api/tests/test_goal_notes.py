"""
Tests for the goal-notes feature (PR #131).

Routes under test:
  GET    /goals/{goal_id}/notes        — list notes (auth required, ownership enforced)
  POST   /goals/{goal_id}/notes        — create note, body: {content, mood}, returns 201
  PATCH  /notes/{note_id}              — partial update, body: {content?, mood?}
  DELETE /notes/{note_id}              — delete, returns 204

Valid moods: "rocket", "happy", "neutral", "sad", "locked"

All HTTP tests are marked xfail(strict=False) because the feature branch is not yet merged.
"""

import pytest

from auth import get_current_user_id
from main import app
from tests.conftest import OTHER_USER_ID, TEST_USER_ID, create_test_goal

pytestmark = pytest.mark.anyio

VALID_MOODS = ["rocket", "happy", "neutral", "sad", "locked"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_note(client, goal_id: str, content: str = "Feeling great today", mood: str = "happy") -> dict:
    """POST a note and return the response JSON (asserts 201)."""
    resp = await client.post(
        f"/goals/{goal_id}/notes",
        json={"content": content, "mood": mood},
    )
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# TestListNotes
# ---------------------------------------------------------------------------


class TestListNotes:
    """GET /goals/{goal_id}/notes"""

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_list_notes_requires_auth(self, client, created_goal):
        """Unauthenticated request returns 401."""
        goal_id = created_goal["id"]
        app.dependency_overrides.pop(get_current_user_id, None)
        try:
            resp = await client.get(f"/goals/{goal_id}/notes")
        finally:
            app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
        assert resp.status_code == 401

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_list_notes_empty(self, client, created_goal):
        """A new goal has no notes — endpoint returns an empty list."""
        goal_id = created_goal["id"]
        resp = await client.get(f"/goals/{goal_id}/notes")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 0

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_list_notes_shows_created_note(self, client, created_goal):
        """After creating a note it appears in the list with correct fields."""
        goal_id = created_goal["id"]
        created = await _create_note(client, goal_id, content="Day 1 done!", mood="rocket")
        note_id = created["id"]

        resp = await client.get(f"/goals/{goal_id}/notes")
        assert resp.status_code == 200
        notes = resp.json()
        assert len(notes) == 1
        note = notes[0]
        assert note["id"] == note_id
        assert note["goal_id"] == goal_id
        assert note["content"] == "Day 1 done!"
        assert note["mood"] == "rocket"

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_list_notes_returns_all_notes_for_goal(self, client, created_goal):
        """Multiple notes are all returned in the list."""
        goal_id = created_goal["id"]
        await _create_note(client, goal_id, content="Note one", mood="happy")
        await _create_note(client, goal_id, content="Note two", mood="neutral")
        await _create_note(client, goal_id, content="Note three", mood="sad")

        resp = await client.get(f"/goals/{goal_id}/notes")
        assert resp.status_code == 200
        notes = resp.json()
        assert len(notes) == 3

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_list_notes_ownership_enforced(self, client, other_client, created_goal):
        """Authenticated user gets 403 when listing notes on another user's goal."""
        goal_id = created_goal["id"]
        await _create_note(client, goal_id, content="Private note", mood="locked")

        resp = await other_client.get(f"/goals/{goal_id}/notes")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# TestCreateNote
# ---------------------------------------------------------------------------


class TestCreateNote:
    """POST /goals/{goal_id}/notes"""

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_create_note_requires_auth(self, client, created_goal):
        """Unauthenticated request returns 401."""
        goal_id = created_goal["id"]
        app.dependency_overrides.pop(get_current_user_id, None)
        try:
            resp = await client.post(
                f"/goals/{goal_id}/notes",
                json={"content": "Should fail", "mood": "happy"},
            )
        finally:
            app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
        assert resp.status_code == 401

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_create_note_returns_201_with_correct_fields(self, client, created_goal):
        """Creating a note returns 201 and the note body with expected fields."""
        goal_id = created_goal["id"]
        resp = await client.post(
            f"/goals/{goal_id}/notes",
            json={"content": "Crushed today's workout!", "mood": "rocket"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["goal_id"] == goal_id
        assert data["content"] == "Crushed today's workout!"
        assert data["mood"] == "rocket"
        # Timestamps should be present
        assert "created_at" in data

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_create_note_missing_content_returns_422(self, client, created_goal):
        """Omitting the required `content` field returns 422 Unprocessable Entity."""
        goal_id = created_goal["id"]
        resp = await client.post(
            f"/goals/{goal_id}/notes",
            json={"mood": "happy"},
        )
        assert resp.status_code == 422

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_create_note_invalid_mood_returns_422(self, client, created_goal):
        """An unrecognised mood value is rejected with 422."""
        goal_id = created_goal["id"]
        resp = await client.post(
            f"/goals/{goal_id}/notes",
            json={"content": "Feeling cosmic", "mood": "cosmic"},
        )
        assert resp.status_code == 422

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    @pytest.mark.parametrize("mood", VALID_MOODS)
    async def test_create_note_all_valid_moods_accepted(self, client, created_goal, mood):
        """Each of the five valid moods is accepted and round-trips correctly."""
        goal_id = created_goal["id"]
        resp = await client.post(
            f"/goals/{goal_id}/notes",
            json={"content": f"Testing mood: {mood}", "mood": mood},
        )
        assert resp.status_code == 201
        assert resp.json()["mood"] == mood

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_create_note_on_nonexistent_goal_returns_404(self, client):
        """Creating a note for a goal that doesn't exist returns 404."""
        fake_goal_id = "00000000-0000-0000-0000-000000000000"
        resp = await client.post(
            f"/goals/{fake_goal_id}/notes",
            json={"content": "Ghost note", "mood": "neutral"},
        )
        assert resp.status_code == 404

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_create_note_on_other_users_goal_returns_403(self, client, other_client, created_goal):
        """User B cannot create a note on User A's goal."""
        goal_id = created_goal["id"]
        resp = await other_client.post(
            f"/goals/{goal_id}/notes",
            json={"content": "Sneaky note", "mood": "neutral"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# TestUpdateNote
# ---------------------------------------------------------------------------


class TestUpdateNote:
    """PATCH /notes/{note_id}"""

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_update_note_requires_auth(self, client, created_goal):
        """Unauthenticated PATCH returns 401."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id)
        note_id = note["id"]

        app.dependency_overrides.pop(get_current_user_id, None)
        try:
            resp = await client.patch(
                f"/notes/{note_id}",
                json={"content": "Updated without auth"},
            )
        finally:
            app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
        assert resp.status_code == 401

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_update_note_content(self, client, created_goal):
        """Updating only the content field persists the new value."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id, content="Original content", mood="neutral")
        note_id = note["id"]

        resp = await client.patch(f"/notes/{note_id}", json={"content": "Updated content"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "Updated content"
        assert data["mood"] == "neutral"  # unchanged

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_update_note_mood(self, client, created_goal):
        """Updating only the mood field persists the new value."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id, content="Steady progress", mood="neutral")
        note_id = note["id"]

        resp = await client.patch(f"/notes/{note_id}", json={"mood": "rocket"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["mood"] == "rocket"
        assert data["content"] == "Steady progress"  # unchanged

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_update_note_partial_update_both_fields(self, client, created_goal):
        """Updating both content and mood at once works correctly."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id, content="First draft", mood="sad")
        note_id = note["id"]

        resp = await client.patch(
            f"/notes/{note_id}",
            json={"content": "Revised note", "mood": "happy"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "Revised note"
        assert data["mood"] == "happy"

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_update_note_invalid_mood_returns_422(self, client, created_goal):
        """Patching with an invalid mood is rejected with 422."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id)
        note_id = note["id"]

        resp = await client.patch(f"/notes/{note_id}", json={"mood": "ecstatic"})
        assert resp.status_code == 422

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_update_note_not_found_returns_404(self, client):
        """Patching a non-existent note returns 404."""
        fake_note_id = "00000000-0000-0000-0000-000000000001"
        resp = await client.patch(
            f"/notes/{fake_note_id}",
            json={"content": "Does not exist"},
        )
        assert resp.status_code == 404

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_update_note_wrong_user_returns_403(self, client, other_client, created_goal):
        """User B cannot update User A's note."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id, content="My note", mood="happy")
        note_id = note["id"]

        resp = await other_client.patch(
            f"/notes/{note_id}",
            json={"content": "Hijacked content"},
        )
        assert resp.status_code == 403

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_update_note_empty_body_is_noop(self, client, created_goal):
        """A PATCH with an empty body is a no-op and still returns 200."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id, content="Leave me alone", mood="locked")
        note_id = note["id"]

        resp = await client.patch(f"/notes/{note_id}", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "Leave me alone"
        assert data["mood"] == "locked"


# ---------------------------------------------------------------------------
# TestDeleteNote
# ---------------------------------------------------------------------------


class TestDeleteNote:
    """DELETE /notes/{note_id}"""

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_delete_note_requires_auth(self, client, created_goal):
        """Unauthenticated DELETE returns 401."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id)
        note_id = note["id"]

        app.dependency_overrides.pop(get_current_user_id, None)
        try:
            resp = await client.delete(f"/notes/{note_id}")
        finally:
            app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
        assert resp.status_code == 401

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_delete_note_returns_204(self, client, created_goal):
        """Deleting an owned note returns 204 No Content."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id, content="To be deleted", mood="neutral")
        note_id = note["id"]

        resp = await client.delete(f"/notes/{note_id}")
        assert resp.status_code == 204

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_delete_note_removes_it_from_list(self, client, created_goal):
        """After deletion the note no longer appears in GET /goals/{goal_id}/notes."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id, content="Temporary note", mood="happy")
        note_id = note["id"]

        del_resp = await client.delete(f"/notes/{note_id}")
        assert del_resp.status_code == 204

        list_resp = await client.get(f"/goals/{goal_id}/notes")
        assert list_resp.status_code == 200
        ids = [n["id"] for n in list_resp.json()]
        assert note_id not in ids

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_delete_note_not_found_returns_404(self, client):
        """Deleting a non-existent note returns 404."""
        fake_note_id = "00000000-0000-0000-0000-000000000002"
        resp = await client.delete(f"/notes/{fake_note_id}")
        assert resp.status_code == 404

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_delete_note_wrong_user_returns_403(self, client, other_client, created_goal):
        """User B cannot delete User A's note."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id, content="Don't touch this", mood="locked")
        note_id = note["id"]

        resp = await other_client.delete(f"/notes/{note_id}")
        assert resp.status_code == 403

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_delete_note_idempotent_second_call_returns_404(self, client, created_goal):
        """Deleting the same note twice: first returns 204, second returns 404."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id, content="One-time note", mood="neutral")
        note_id = note["id"]

        resp1 = await client.delete(f"/notes/{note_id}")
        assert resp1.status_code == 204

        resp2 = await client.delete(f"/notes/{note_id}")
        assert resp2.status_code == 404


# ---------------------------------------------------------------------------
# TestOwnershipIsolation
# ---------------------------------------------------------------------------


class TestOwnershipIsolation:
    """Cross-user data-isolation checks: User B must not be able to see or mutate User A's notes."""

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_user_b_cannot_list_user_a_notes(self, client, other_client, created_goal):
        """User B gets 403 when they try to list notes on User A's goal."""
        goal_id = created_goal["id"]
        await _create_note(client, goal_id, content="User A's private thought", mood="happy")

        resp = await other_client.get(f"/goals/{goal_id}/notes")
        assert resp.status_code == 403

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_user_b_cannot_create_note_on_user_a_goal(self, client, other_client, created_goal):
        """User B gets 403 when they try to add a note to User A's goal."""
        goal_id = created_goal["id"]
        resp = await other_client.post(
            f"/goals/{goal_id}/notes",
            json={"content": "Intruder note", "mood": "neutral"},
        )
        assert resp.status_code == 403

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_user_b_cannot_update_user_a_note(self, client, other_client, created_goal):
        """User B gets 403 when they try to PATCH User A's note."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id, content="User A note", mood="rocket")
        note_id = note["id"]

        resp = await other_client.patch(
            f"/notes/{note_id}",
            json={"content": "Overwritten by B"},
        )
        assert resp.status_code == 403

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_user_b_cannot_delete_user_a_note(self, client, other_client, created_goal):
        """User B gets 403 when they try to DELETE User A's note."""
        goal_id = created_goal["id"]
        note = await _create_note(client, goal_id, content="User A note", mood="sad")
        note_id = note["id"]

        resp = await other_client.delete(f"/notes/{note_id}")
        assert resp.status_code == 403

    @pytest.mark.xfail(strict=False, reason="feature/goal-notes not merged yet")
    async def test_user_b_notes_not_visible_to_user_a(self, client, other_client, engine):
        """Notes created by User B on their own goal are not accessible to User A."""
        # User B creates their own goal and note
        goal_b_resp = await other_client.post(
            f"/users/{OTHER_USER_ID}/goals",
            json={"raw_input": "User B goal for isolation test"},
        )
        assert goal_b_resp.status_code == 202
        goal_b_id = goal_b_resp.json()["id"]

        note_b = await _create_note(other_client, goal_b_id, content="User B's note", mood="happy")
        note_b_id = note_b["id"]

        # User A cannot list User B's goal notes
        resp_list = await client.get(f"/goals/{goal_b_id}/notes")
        assert resp_list.status_code == 403

        # User A cannot update User B's note
        resp_patch = await client.patch(
            f"/notes/{note_b_id}",
            json={"content": "Stolen"},
        )
        assert resp_patch.status_code == 403

        # User A cannot delete User B's note
        resp_delete = await client.delete(f"/notes/{note_b_id}")
        assert resp_delete.status_code == 403
