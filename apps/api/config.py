from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/goalforge"
    gemini_api_key: str = ""
    # Vertex AI mode: bill Gemini through a GCP project (uses cloud credits)
    # instead of an AI Studio API key. When true, google_cloud_project and a
    # service-account key (google_application_credentials path) are required.
    google_genai_use_vertexai: bool = False
    google_cloud_project: str = ""
    google_cloud_location: str = "global"
    google_application_credentials: str = ""  # path to service-account JSON
    debug: bool = False
    clerk_secret_key: str = ""
    clerk_jwks_url: str = ""
    cors_origins: str = "http://localhost:5173"
    environment: str = "development"
    rate_limit_enabled: bool = True
    jobs_api_key: str = ""  # if empty, 401 is always returned — no dev bypass
    resend_api_key: str = ""  # if empty, emails are logged instead of sent
    feedback_notify_email: str = ""  # owner inbox for user feedback; if empty, logged only
    dev_email_override: str | None = None  # if set, all emails route here (dev/testing only)
    vapid_private_key: str = ""
    vapid_subject: str = ""
    guard_model: str = "gemini-2.5-flash-lite"  # AI input-guard classifier model
    coach_daily_message_limit: int = 30  # coach user-messages per user per day
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800


settings = Settings()
