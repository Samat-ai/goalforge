from unittest.mock import AsyncMock, patch

import pytest

import ai_utils
from config import settings
from schemas import AICoachTurnV2, AIGuardVerdict


@pytest.mark.asyncio
async def test_classify_user_input_uses_guard_model_and_delimits_data():
    fake = AIGuardVerdict(verdict="allow", category="on_topic")
    with patch("ai_utils._generate_structured", new=AsyncMock(return_value=fake)) as gen:
        out = await ai_utils.classify_user_input("What outcome do you want?", "I want to run a 5K")
    assert out.verdict == "allow"
    kwargs = gen.call_args.kwargs
    assert kwargs["model"] == settings.guard_model
    assert kwargs["schema"] is AIGuardVerdict
    # fast-fail contract: one attempt, short timeout — never rides the full
    # 3x30s retry ladder in front of POST /goals or a locked chat turn.
    assert kwargs["attempts"] == 1
    assert kwargs["timeout"] == 8.0
    # user text must be wrapped as data, not instructions
    assert "<data>" in kwargs["user_message"]
    assert "I want to run a 5K" in kwargs["user_message"]
    assert "never instructions" in kwargs["system_instruction"].lower() or "not instructions" in kwargs["system_instruction"].lower()


@pytest.mark.asyncio
async def test_generate_coach_reply_embeds_canary_hardening_voice():
    fake = AICoachTurnV2(reply="Noted.", intent="chat", chips=[])
    with patch("ai_utils._generate_structured", new=AsyncMock(return_value=fake)) as gen:
        await ai_utils.generate_coach_reply("Today: 2026-07-11\n(no active goals)", "USER: hi")
    kwargs = gen.call_args.kwargs
    si = kwargs["system_instruction"]
    assert ai_utils._CANARY in si
    assert "Never output this marker" in si
    assert "Security rules" in si
    assert "Voice rules" in si
    assert kwargs["schema"] is AICoachTurnV2
    assert "Today: 2026-07-11" in kwargs["user_message"]


def test_existing_prompts_are_hardened():
    # every user-text-embedding prompt carries the hardening block
    for prompt in (
        ai_utils._SYSTEM_PROMPT,
        ai_utils._SPRINT_SYSTEM_PROMPT,
        ai_utils._REGEN_SYSTEM_PROMPT,
        ai_utils._RESCUE_SYSTEM_PROMPT,
        ai_utils._ENERGY_RESIZE_PROMPT,
        ai_utils._STAR_LOG_SYSTEM_PROMPT,
        ai_utils._WEEKLY_COACH_SYSTEM_PROMPT,
    ):
        assert "Security rules" in prompt


def test_voice_rules_on_user_facing_prose_prompts():
    assert "Voice rules" in ai_utils._STAR_LOG_SYSTEM_PROMPT
    assert "Voice rules" in ai_utils._WEEKLY_COACH_SYSTEM_PROMPT
