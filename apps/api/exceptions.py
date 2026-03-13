class AIGenerationError(Exception):
    def __init__(self, message: str = "AI generation failed after multiple attempts"):
        super().__init__(message)
