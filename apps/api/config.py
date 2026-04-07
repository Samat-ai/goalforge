from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/goalforge"
    gemini_api_key: str = ""
    debug: bool = False
    clerk_secret_key: str = ""
    clerk_jwks_url: str = ""
    cors_origins: str = "http://localhost:5173"
    environment: str = "development"
    rate_limit_enabled: bool = True
    jobs_api_key: str = ""  # if empty, 401 is always returned — no dev bypass
    resend_api_key: str = ""  # if empty, emails are logged instead of sent
    dev_email_override: str | None = None  # if set, all emails route here (dev/testing only)
    vapid_private_key: str = ""
    vapid_subject: str = ""
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800


settings = Settings()
