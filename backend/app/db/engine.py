from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings


def create_engine(url: str | None = None) -> AsyncEngine:
    settings = get_settings()
    url = url or settings.database_url
    return create_async_engine(
        url,
        echo=False,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={"charset": "utf8mb4"},
    )


engine: AsyncEngine = create_engine()
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
