from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Set test environment before imports
os.environ["TTS_INVITE_CODE"] = "test-invite-123"
os.environ["TTS_APP_ORIGIN"] = "http://localhost:5173"

from app.core.config import get_settings
from app.db.base import Base
from app.main import create_app
import app.models  # noqa: F401


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    settings = get_settings()
    test_engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_pre_ping=True,
    )
    test_sessionmaker = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    app = create_app()

    from app.api.deps import get_session

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        async with test_sessionmaker() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://localhost:5173",
        headers={"origin": "http://localhost:5173"},
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
    await test_engine.dispose()
