import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import settings

_is_sqlite = settings.database_url.startswith("sqlite")
_pool_kwargs = {} if _is_sqlite else {
    "pool_size": settings.db_pool_size,
    "max_overflow": settings.db_max_overflow,
    "pool_timeout": settings.db_pool_timeout,
}

_connect_args = {}
if settings.database_ssl_required and not _is_sqlite:
    if settings.database_ca_file:
        # Full verification against the provider's published CA.
        _ssl_ctx = ssl.create_default_context(cafile=settings.database_ca_file)
    else:
        # sslmode=require semantics: encrypted, unverified. Heroku Essential
        # Postgres presents self-signed per-instance certs with no published
        # CA, so verification is impossible there — encryption still protects
        # the dyno<->db path. Set DATABASE_CA_FILE when a CA is available.
        _ssl_ctx = ssl.create_default_context()
        _ssl_ctx.check_hostname = False
        _ssl_ctx.verify_mode = ssl.CERT_NONE
    _connect_args["ssl"] = _ssl_ctx

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=not _is_sqlite,
    pool_recycle=settings.db_pool_recycle,
    connect_args=_connect_args,
    **_pool_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
