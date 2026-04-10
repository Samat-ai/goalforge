import time
import logging
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger("goalforge.db")

SLOW_QUERY_THRESHOLD_MS = 200  # log queries slower than this


def register_slow_query_listener(engine: AsyncEngine) -> None:
    """Register an event listener that logs slow SQL queries."""

    sync_engine = engine.sync_engine

    @event.listens_for(sync_engine, "before_cursor_execute")
    def before_execute(conn, cursor, statement, params, context, executemany):
        conn.info.setdefault("query_start_time", []).append(time.monotonic())

    @event.listens_for(sync_engine, "after_cursor_execute")
    def after_execute(conn, cursor, statement, params, context, executemany):
        total = time.monotonic() - conn.info["query_start_time"].pop(-1)
        ms = total * 1000
        if ms > SLOW_QUERY_THRESHOLD_MS:
            # Truncate long queries for readability
            short_stmt = " ".join(statement.split())[:300]
            logger.warning(
                "Slow query %.1fms: %s",
                ms,
                short_stmt,
            )
