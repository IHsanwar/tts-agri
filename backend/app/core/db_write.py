from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import SessionLocal

_write_lock = asyncio.Lock()


@asynccontextmanager
async def write_session() -> AsyncIterator[AsyncSession]:
    """Acquire transaction lock and run a committed transaction on MySQL."""
    async with _write_lock:
        async with SessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
