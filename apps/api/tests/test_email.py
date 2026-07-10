"""Tests for email_service HTML builders."""

from services.email_service import (
    TaskDigestItem,
    _build_digest_html,
    _build_rescue_html,
    _digest_subject,
)


def _tasks(n: int) -> list[TaskDigestItem]:
    return [
        TaskDigestItem(
            description=f"Task {i}",
            tip=f"Tip {i}",
            goal_title="Ship the feature",
        )
        for i in range(n)
    ]


def test_digest_html_contains_energy_cta():
    """_build_digest_html includes the low-energy CTA link."""
    html = _build_digest_html("Test User", _tasks(1))
    assert "?energy=low" in html


def test_digest_html_greets_by_name_and_lists_tasks():
    html = _build_digest_html("Samat", _tasks(3))
    assert "Hi Samat. It's Solly." in html
    assert "Task 0" in html and "Task 2" in html
    assert "3 tasks are waiting" in html


def test_digest_html_singular_copy_for_one_task():
    html = _build_digest_html(None, _tasks(1))
    assert "One task is waiting" in html
    assert "Star Forger" in html  # fallback name


def test_digest_html_escapes_task_content():
    tasks = [TaskDigestItem(description="<script>x</script>", tip="t", goal_title="g")]
    html = _build_digest_html("A", tasks)
    assert "<script>" not in html


def test_digest_subject_is_count_aware():
    assert _digest_subject(1) == "One task stands between you and a brighter star"
    assert "(4 tasks waiting)" in _digest_subject(4)


def test_rescue_html_links_to_dashboard():
    html = _build_rescue_html("Samat")
    assert "/dashboard" in html
    assert "Easy Mode" in html
    assert "Samat" in html
