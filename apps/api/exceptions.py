class AIGenerationError(Exception):
    """Raised when Gemini AI generation fails"""
    def __init__(self, message: str, original_error: Exception | None = None):
        super().__init__(message)
        self.original_error = original_error


class SprintGenerationError(AIGenerationError):
    """Raised specifically during sprint/milestone task generation"""


class GoalGenerationError(AIGenerationError):
    """Raised specifically during SMART goal generation"""


class TaskResizeError(AIGenerationError):
    """Raised during energy resize task generation"""
