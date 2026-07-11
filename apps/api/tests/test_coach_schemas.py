import pytest
from pydantic import ValidationError

from config import settings
from schemas import AICoachTurnV2, AIGuardVerdict, AIPlanEdit


def test_settings_have_guard_defaults():
    assert settings.guard_model == "gemini-2.5-flash-lite"
    assert settings.coach_daily_message_limit == 20


def test_guard_verdict_accepts_known_verdicts():
    v = AIGuardVerdict(verdict="deflect", category="injection")
    assert v.verdict == "deflect"
    with pytest.raises(ValidationError):
        AIGuardVerdict(verdict="block", category="x")


def test_coach_turn_v2_chat_minimal():
    turn = AICoachTurnV2(reply="Tell me more.", intent="chat", chips=[])
    assert turn.forge_brief is None
    assert turn.edits is None
    assert turn.session_title is None


def test_coach_turn_v2_edit_payload():
    turn = AICoachTurnV2(
        reply="Done.",
        intent="edit_plan",
        chips=["Thanks"],
        edits=[AIPlanEdit(target="task_description", target_id="not-a-uuid", new_value="Run 10 minutes")],
    )
    # target_id is a plain string on the AI-facing schema; UUID parsing happens
    # in the service so invalid ids become dropped edits, not 500s.
    assert turn.edits[0].target_id == "not-a-uuid"


def test_coach_turn_v2_reply_capped():
    with pytest.raises(ValidationError):
        AICoachTurnV2(reply="x" * 901, intent="chat", chips=[])
