"""
AI utilities for GoalForge.

Uses the official Google Gen AI SDK (google-genai) with Gemini 2.5 Flash.
Structured output is enforced by passing the Pydantic schema directly to the
`response_schema` parameter so the model is constrained to valid JSON.
"""

import json
import logging
from datetime import date

from google import genai
from google.genai import types

from config import settings
from schemas import AIGoalOutput

logger = logging.getLogger(__name__)

# Initialise the client once at module load (reads GEMINI_API_KEY from env via
# settings, but the SDK also honours the GOOGLE_API_KEY env var natively).
_client = genai.Client(api_key=settings.gemini_api_key)

_MODEL = "gemini-2.5-flash"

_SYSTEM_PROMPT = """\
You are GoalForge AI, an expert life coach and productivity specialist.
Your job is to transform a user's raw, vague goal description into a
fully structured SMART goal with an actionable first-week task plan.

Rules:
- target_date must be in the future (today is {today}).
- milestones must be chronologically ordered stepping stones toward the goal.
- initial_tasks covers exactly the first 7 days; assigned_date must start
  from today and increment by one day per task.
- Be specific, realistic, and encouraging.
"""


async def generate_smart_goal(raw_input: str) -> AIGoalOutput:
    """
    Call Gemini 2.5 Flash with a user's raw goal string.

    Returns a validated AIGoalOutput Pydantic model whose fields map
    directly onto the Goal and DailyTask database tables.

    Raises:
        ValueError: if the model returns unparseable or schema-invalid JSON.
        google.genai.errors.APIError: on upstream API failures.
    """
    today = date.today().isoformat()
    system_instruction = _SYSTEM_PROMPT.format(today=today)

    user_message = (
        f"Transform this goal into a structured SMART goal plan:\n\n{raw_input}"
    )

    response = await _client.aio.models.generate_content(
        model=_MODEL,
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            # Enforce JSON output that matches our Pydantic schema
            response_mime_type="application/json",
            response_schema=AIGoalOutput,
            temperature=1.0,   # Gemini 2.5 Flash thinking works best at 1.0
        ),
    )

    raw_json: str = response.text
    logger.debug("Gemini raw response: %s", raw_json)

    try:
        data = json.loads(raw_json)
        return AIGoalOutput.model_validate(data)
    except Exception as exc:
        logger.error("Failed to parse Gemini response: %s\nRaw: %s", exc, raw_json)
        raise ValueError(f"AI returned invalid structured output: {exc}") from exc
