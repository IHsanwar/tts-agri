from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite")


def create_engine(url: str | None = None) -> AsyncEngine:
    settings = get_settings()
    url = url or settings.database_url
    connect_args: dict[str, Any] = {}
    if _is_sqlite(url):
        connect_args["check_same_thread"] = False
    return create_async_engine(url, echo=False, connect_args=connect_args)


engine: AsyncEngine = create_engine()
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "connect")
def _on_sqlite_connect(dbapi_conn: Any, _record: Any) -> None:
    if not _is_sqlite(str(engine.url)):
        return
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.close()


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
