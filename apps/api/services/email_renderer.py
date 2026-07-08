"""
Jinja2-based HTML email renderer for GoalForge.
"""
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "j2"]),
)

APP_URL = "https://goalforge.app"  # Override via config in production


def render_daily_digest(
    display_name: str,
    tasks_by_goal: list[dict],  # [{"goal_title": str, "tasks": [str]}]
    star_points: int,
    app_url: str = APP_URL,
) -> tuple[str, str]:
    """Returns (html_body, plain_text_body)."""
    template = _env.get_template("daily_digest.html.j2")
    html = template.render(
        header_subtitle="Your Daily Mission",
        display_name=display_name,
        tasks_by_goal=tasks_by_goal,
        star_points=star_points,
        app_url=app_url,
        subject="Your GoalForge tasks for today",
    )
    plain = _build_plain_digest(display_name, tasks_by_goal)
    return html, plain


def render_rescue_email(
    display_name: str,
    goal_title: str,
    rescue_tasks: list[str],
    app_url: str = APP_URL,
) -> tuple[str, str]:
    """Returns (html_body, plain_text_body)."""
    template = _env.get_template("rescue_email.html.j2")
    html = template.render(
        header_subtitle="We've got your back",
        display_name=display_name,
        goal_title=goal_title,
        rescue_tasks=rescue_tasks,
        app_url=app_url,
        subject="Fresh start ready for you 🔥",
    )
    plain = f"Hi {display_name},\n\nWe've prepared a fresh start for {goal_title}.\n\n" + "\n".join(f"• {t}" for t in rescue_tasks)
    return html, plain


def render_weekly_star_log(
    display_name: str,
    week_number: int,
    narrative: str,
    stats: dict,  # {tasks_completed, stars_earned, streak_days, stage_name}
    app_url: str = APP_URL,
) -> tuple[str, str]:
    """Returns (html_body, plain_text_body)."""
    template = _env.get_template("weekly_star_log.html.j2")
    html = template.render(
        header_subtitle=f"Week {week_number} Complete",
        display_name=display_name,
        week_number=week_number,
        narrative=narrative,
        stats=stats,
        app_url=app_url,
        subject=f"Your Week {week_number} Star Log ⭐",
    )
    plain = f"Week {week_number} Star Log\n\n{narrative}\n\nTasks: {stats.get('tasks_completed', 0)} | Stars: {stats.get('stars_earned', 0)}"
    return html, plain


def _build_plain_digest(display_name: str, tasks_by_goal: list[dict]) -> str:
    lines = [f"Good morning, {display_name}!\n\nHere's what's on your plate today:\n"]
    for goal in tasks_by_goal:
        lines.append(f"\n{goal['goal_title']}")
        for task in goal.get("tasks", []):
            lines.append(f"  • {task}")
    return "\n".join(lines)
