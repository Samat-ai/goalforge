"""Settings validators — DATABASE_URL scheme normalization (Heroku compat)."""

from config import Settings


def _settings_with_url(url: str) -> Settings:
    # _env_file=None keeps the developer's local .env out of the test.
    return Settings(_env_file=None, database_url=url)


def test_heroku_legacy_postgres_scheme_normalized():
    s = _settings_with_url("postgres://user:pw@host:5432/db")
    assert s.database_url == "postgresql+asyncpg://user:pw@host:5432/db"


def test_plain_postgresql_scheme_normalized():
    s = _settings_with_url("postgresql://user:pw@host:5432/db")
    assert s.database_url == "postgresql+asyncpg://user:pw@host:5432/db"


def test_explicit_asyncpg_scheme_untouched():
    url = "postgresql+asyncpg://user:pw@host:5432/db"
    assert _settings_with_url(url).database_url == url


def test_sqlite_scheme_untouched():
    url = "sqlite+aiosqlite:///:memory:"
    assert _settings_with_url(url).database_url == url


def test_ssl_not_required_by_default():
    assert _settings_with_url("postgres://u:p@h/db").database_ssl_required is False
