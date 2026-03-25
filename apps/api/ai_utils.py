"""
AI utilities for GoalForge.

Uses the official Google Gen AI SDK (google-genai) with Gemini 2.5 Flash.
Structured output is enforced by passing the Pydantic schema directly to the
`response_schema` parameter so the model is constrained to valid JSON.
"""

import asyncio
import json
import logging
from datetime import date, timedelta

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import ValidationError

from config import settings
from exceptions import AIGenerationError
from schemas import (
    AIGoalOutput,
    AIRescueOutput,
    AIRescueTaskItem,
    AISprintOutput,
    AIStarLogOutput,
    AITaskOutput,
    AIWeeklyCoachOutput,
)

logger = logging.getLogger(__name__)

# Initialise the client once at module load (reads GEMINI_API_KEY from env via
# settings, but the SDK also honours the GOOGLE_API_KEY env var natively).
_client = genai.Client(api_key=settings.gemini_api_key)

_MODEL = "gemini-2.5-flash"

_SYSTEM_PROMPT = """\
You are GoalForge AI, an expert life coach and productivity specialist.
Your job is to transform a user's raw, vague goal description into a
fully structured SMART goal with an actionable first-sprint task plan.

Rules:
- target_date must be in the future (today is {today}).
- Choose 3-5 milestones as chronologically ordered sprint stepping stones.
  Each milestone covers one 7-day sprint. Set is_final=true ONLY on the last milestone.
  sprint_theme should be a short phrase describing the focus of that sprint (e.g. "Core strength foundation").
- initial_tasks covers exactly 7 days for the FIRST milestone only.
  assigned_date must start from today and increment by one day per task.
- Be specific, realistic, and encouraging.
"""

_SPRINT_SYSTEM_PROMPT = """\
You are GoalForge AI generating a focused 7-day sprint task plan.

Goal context: {goal_context}
Sprint theme: {sprint_theme}
Sprint start date: {start_date} (Day 1 of 7)
Difficulty mode: {difficulty_mode}

Rules:
- Generate exactly 7 daily tasks, one per day.
- assigned_date runs from {start_date} (Day 1) to {end_date} (Day 7) inclusive.
- Each task must directly serve the sprint theme and the overall goal.
- Keep descriptions ≤20 words, actionable and specific.
- Keep tips ≤20 words, motivational and explaining why it helps.
- If difficulty_mode is "lighter": prefer low-friction tasks, shorter duration, and confidence-building wins.
- If difficulty_mode is "balanced": keep normal progression with moderate challenge.
- If difficulty_mode is "stretch": increase challenge slightly while remaining realistic for one day.
"""

# Delays (in seconds) between consecutive attempts: attempt 1→2 waits 1s, 2→3 waits 2s.
_RETRY_DELAYS = (1, 2)


_AI_TIMEOUT = 30.0  # seconds per Gemini call attempt


async def _with_retry(make_coro, label: str):
    """
    Call make_coro() up to 3 times with exponential backoff.

    Retries on: APIError, JSONDecodeError, ValidationError, TimeoutError.
    Raises AIGenerationError on final failure.
    """
    last_exc: Exception | None = None
    for attempt in range(1, 4):  # attempts 1, 2, 3
        try:
            return await asyncio.wait_for(make_coro(), timeout=_AI_TIMEOUT)
        except (genai_errors.APIError, json.JSONDecodeError, ValidationError, asyncio.TimeoutError) as exc:
            last_exc = exc
            if attempt < 3:
                delay = _RETRY_DELAYS[attempt - 1]
                logger.warning(
                    "AI %s attempt %d/3 failed (%s: %s). Retrying in %ds…",
                    label, attempt, type(exc).__name__, exc, delay,
                )
                await asyncio.sleep(delay)
    logger.error("AI %s failed after 3 attempts. Last error: %s", label, last_exc)
    raise AIGenerationError(
        f"AI generation failed after 3 attempts. Last error: {type(last_exc).__name__}: {last_exc}"
    )


async def generate_smart_goal(raw_input: str, today: date | None = None) -> AIGoalOutput:
    """
    Call Gemini 2.5 Flash with a user's raw goal string.

    Args:
        raw_input: The user's plain-language goal description.
        today:     The user's local calendar date. Defaults to server date if omitted.

    Returns a validated AIGoalOutput Pydantic model whose fields map
    directly onto the Goal, Milestone, and DailyTask database tables.

    Raises:
        AIGenerationError: after 3 failed attempts (APIError, JSONDecodeError, or ValidationError).
    """
    today_str = (today or date.today()).isoformat()
    system_instruction = _SYSTEM_PROMPT.format(today=today_str)
    user_message = (
        f"Transform this goal into a structured SMART goal plan:\n\n{raw_input}"
    )

    async def _call() -> AIGoalOutput:
        response = await _client.aio.models.generate_content(
            model=_MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=AIGoalOutput,
                temperature=1.0,   # Gemini 2.5 Flash thinking works best at 1.0
            ),
        )
        raw_json: str = response.text
        logger.debug("Gemini raw response (goal): %s", raw_json)
        data = json.loads(raw_json)
        return AIGoalOutput.model_validate(data)

    return await _with_retry(_call, "generate_smart_goal")


async def generate_sprint_tasks(
    goal_context: str,
    sprint_theme: str,
    start_date: date,
    difficulty_mode: str = "balanced",
) -> list[AITaskOutput]:
    """
    Generate 7 daily tasks for a future sprint milestone.

    Called as a background task when the final task of the current sprint is
    completed (Magic Pre-Gen), and synchronously inside the milestone advance
    endpoint if pre-gen didn't complete in time.

    Args:
        goal_context: Human-readable goal summary, e.g. "Run a marathon: Build
                      endurance to complete 42km by race day."
        sprint_theme: Short phrase describing this sprint's focus, e.g.
                      "Core strength foundation".
        start_date:   The calendar date for Day 1 of this sprint.

    Returns:
        list of AITaskOutput (7 items, one per day).

    Raises:
        AIGenerationError: after 3 failed attempts (APIError, JSONDecodeError, or ValidationError).
    """
    end_date = (start_date + timedelta(days=6)).isoformat()
    system_instruction = _SPRINT_SYSTEM_PROMPT.format(
        goal_context=goal_context,
        sprint_theme=sprint_theme,
        start_date=start_date.isoformat(),
        end_date=end_date,
        difficulty_mode=difficulty_mode,
    )
    user_message = (
        f"Generate the 7-day task plan for this sprint: {sprint_theme}\n"
        f"Goal: {goal_context}"
    )

    async def _call() -> list[AITaskOutput]:
        response = await _client.aio.models.generate_content(
            model=_MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=AISprintOutput,
                temperature=1.0,
            ),
        )
        raw_json: str = response.text
        logger.debug("Gemini raw response (sprint): %s", raw_json)
        data = json.loads(raw_json)
        sprint = AISprintOutput.model_validate(data)
        return sprint.tasks

    return await _with_retry(_call, "generate_sprint_tasks")


_REGEN_SYSTEM_PROMPT = """\
You are GoalForge AI regenerating a single daily task.

Goal context: {goal_context}
Sprint theme: {sprint_theme}
Task date: {assigned_date}
Current task (DO NOT repeat): {current_description}

Rules:
- Generate exactly ONE new task that is DIFFERENT from the current task.
- The new task must serve the sprint theme and overall goal.
- Keep description ≤20 words, actionable and specific.
- Keep tip ≤20 words, motivational and explaining why it helps.
- Use the same assigned_date: {assigned_date}.
"""


async def regenerate_single_task(
    goal_context: str,
    sprint_theme: str,
    assigned_date: date,
    current_description: str,
) -> AITaskOutput:
    """
    Call Gemini to generate a single replacement task different from the current one.

    Raises:
        AIGenerationError: after 3 failed attempts.
    """
    system_instruction = _REGEN_SYSTEM_PROMPT.format(
        goal_context=goal_context,
        sprint_theme=sprint_theme,
        assigned_date=assigned_date.isoformat(),
        current_description=current_description,
    )
    user_message = (
        f"Generate a replacement task for: {current_description}\n"
        f"Sprint theme: {sprint_theme}\nGoal: {goal_context}"
    )

    async def _call() -> AITaskOutput:
        response = await _client.aio.models.generate_content(
            model=_MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=AITaskOutput,
                temperature=1.0,
            ),
        )
        raw_json: str = response.text
        logger.debug("Gemini raw response (regen): %s", raw_json)
        data = json.loads(raw_json)
        return AITaskOutput.model_validate(data)

    return await _with_retry(_call, "regenerate_single_task")


_RESCUE_SYSTEM_PROMPT = """\
You are helping a user who has missed several days of their goal plan.
Goal: {goal_title}
Goal description: {goal_description}

Generate exactly 2 recovery micro-tasks. Each task must:
- Take 2 minutes or less
- Require almost zero willpower to start
- Feel like a guaranteed win, not a chore
- Be directly relevant to the goal
- Be written in second-person, action-first ("Listen to...", "Write one...", "Review...")
- Keep description under 70 characters

Tone: encouraging, zero shame, zero pressure.
"""


_WEEKLY_COACH_SYSTEM_PROMPT = """\
You are GoalForge Coach. Based on weekly reflection and execution metrics,
write one concise coaching recommendation for next week.

Rules:
- Be practical and specific (1-3 actions).
- Keep tone supportive, non-judgmental, and confidence-building.
- Reference both what worked and what blocked progress.
- Max 4 sentences.
"""


async def generate_rescue_tasks(
    goal_title: str,
    goal_description: str,
) -> list[AIRescueTaskItem]:
    """Generate 2 AI micro-tasks for a Recovery Sprint."""

    user_message = f"Generate 2 recovery micro-tasks for goal: {goal_title}"

    async def _attempt() -> list[AIRescueTaskItem]:
        response = await _client.aio.models.generate_content(
            model=_MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=_RESCUE_SYSTEM_PROMPT.format(
                    goal_title=goal_title,
                    goal_description=goal_description,
                ),
                temperature=1.0,
                response_mime_type="application/json",
                response_schema=AIRescueOutput,
            ),
        )
        data = json.loads(response.text)
        parsed = AIRescueOutput.model_validate(data)
        return parsed.tasks

    return await _with_retry(_attempt, "generate_rescue_tasks")


_ENERGY_RESIZE_PROMPT = """\
You are GoalForge AI helping a user who is low on energy today.
Original task: {original_description}
Goal context: {goal_context}
Sprint theme: {sprint_theme}

Your job is to find the single, absurdly small FIRST STEP that physically initiates this task.

Rules:
- The micro-task MUST be the literal first physical or digital action toward the original task.
  (e.g. "Open your notes app" not "Review your notes strategy")
- It must be completable in under 3 minutes.
- The description MUST start with a strong action verb: Open, Put on, Type, Pull up, Set, Write.
- Keep description <= 15 words.
- The tip MUST be empathetic and zero-pressure.
  Good: "Just doing this is a win today." Bad: "Stay consistent!"
- Keep tip <= 15 words.
- Do NOT invent a thematic alternative. Stay anchored to the original task.
- Use the same assigned_date: {assigned_date}.
"""


async def resize_task_for_low_energy(
    goal_context: str,
    sprint_theme: str,
    original_description: str,
    assigned_date: date,
) -> AITaskOutput:
    """
    Generate a 3-minute first-step micro-task from an original task description.

    IMPORTANT: Callers must consume ONLY result.description and result.tip.
    result.assigned_date must be DISCARDED — never write it back to the DB.

    Raises:
        AIGenerationError: after 3 failed attempts.
    """
    system_instruction = _ENERGY_RESIZE_PROMPT.format(
        original_description=original_description,
        goal_context=goal_context,
        sprint_theme=sprint_theme,
        assigned_date=assigned_date.isoformat(),
    )
    user_message = (
        f"Generate a 3-minute first step for: {original_description}\n"
        f"Goal: {goal_context}"
    )

    async def _call() -> AITaskOutput:
        response = await _client.aio.models.generate_content(
            model=_MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=AITaskOutput,
                temperature=1.0,
            ),
        )
        raw_json: str = response.text
        logger.debug("Gemini raw response (energy_resize): %s", raw_json)
        data = json.loads(raw_json)
        return AITaskOutput.model_validate(data)

    return await _with_retry(_call, "resize_task_for_low_energy")


async def generate_weekly_coach_recommendation(
    went_well: str,
    blockers: str,
    week_rating: int,
    completion_rate: float,
    overdue_tasks: int,
) -> str:
    """Generate a concise coaching recommendation for the next week."""

    user_message = (
        "Weekly reflection inputs:\n"
        f"- Went well: {went_well}\n"
        f"- Blockers: {blockers}\n"
        f"- Self rating (1-5): {week_rating}\n"
        f"- Completion rate: {round(completion_rate * 100)}%\n"
        f"- Overdue tasks: {overdue_tasks}\n"
        "Return one recommendation only."
    )

    async def _attempt() -> str:
        response = await _client.aio.models.generate_content(
            model=_MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=_WEEKLY_COACH_SYSTEM_PROMPT,
                temperature=1.0,
                response_mime_type="application/json",
                response_schema=AIWeeklyCoachOutput,
            ),
        )
        data = json.loads(response.text)
        parsed = AIWeeklyCoachOutput.model_validate(data)
        return parsed.recommendation

    return await _with_retry(_attempt, "generate_weekly_coach_recommendation")


_STAR_LOG_SYSTEM_PROMPT = """\
You write a short weekly Star Log chapter for GoalForge.

Inputs:
- date range: {start_date} to {end_date}
- completed task count: {completed_tasks}
- completed distinct days: {completed_days}
- completed task snippets: {task_snippets}

Rules:
- Keep tone encouraging, specific, and grounded in completed actions only.
- Avoid generic motivational filler.
- chapter_title: 3-8 words.
- chapter_body: 2 short paragraphs (max 110 words total).
- highlights: 2-3 concise bullet-like lines.
- Never shame the user.
"""


async def generate_star_log_narrative(
    *,
    start_date: date,
    end_date: date,
    completed_tasks: int,
    completed_days: int,
    task_snippets: list[str],
) -> AIStarLogOutput:
    """Generate a narrative Star Log chapter for a user's recent 7-day effort."""

    snippets = task_snippets[:8]
    snippet_text = " | ".join(snippets) if snippets else "No completed tasks in this window"
    system_instruction = _STAR_LOG_SYSTEM_PROMPT.format(
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        completed_tasks=completed_tasks,
        completed_days=completed_days,
        task_snippets=snippet_text,
    )
    user_message = (
        "Write the user's weekly Star Log chapter from this evidence. "
        "Only mention actions present in completed tasks."
    )

    async def _call() -> AIStarLogOutput:
        response = await _client.aio.models.generate_content(
            model=_MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=AIStarLogOutput,
                temperature=1.0,
            ),
        )
        raw_json: str = response.text
        logger.debug("Gemini raw response (star_log): %s", raw_json)
        data = json.loads(raw_json)
        return AIStarLogOutput.model_validate(data)

    return await _with_retry(_call, "generate_star_log_narrative")
