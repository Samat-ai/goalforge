"""Tests for adaptive sprint difficulty helpers."""

from services.task_service import difficulty_mode_from_rate


def test_difficulty_mode_defaults_to_balanced_with_small_sample():
    assert difficulty_mode_from_rate(None, 0) == "balanced"
    assert difficulty_mode_from_rate(0.95, 3) == "balanced"


def test_difficulty_mode_returns_lighter_for_low_completion():
    assert difficulty_mode_from_rate(0.2, 10) == "lighter"
    assert difficulty_mode_from_rate(0.49, 8) == "lighter"


def test_difficulty_mode_returns_stretch_for_high_completion():
    assert difficulty_mode_from_rate(0.9, 10) == "stretch"
    assert difficulty_mode_from_rate(0.86, 7) == "stretch"


def test_difficulty_mode_returns_balanced_for_mid_completion():
    assert difficulty_mode_from_rate(0.5, 10) == "balanced"
    assert difficulty_mode_from_rate(0.8, 10) == "balanced"
