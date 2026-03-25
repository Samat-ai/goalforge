"""Tests for email_service HTML builders."""

from services.email_service import TaskDigestItem, _build_digest_html


def test_digest_html_contains_energy_cta():
    """_build_digest_html includes the low-energy CTA link."""
    tasks = [
        TaskDigestItem(
            description="Write unit tests",
            tip="Start small",
            goal_title="Ship the feature",
        )
    ]
    html = _build_digest_html("Test User", tasks)
    assert "?energy=low" in html
