from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.time import utcnow
from app.db.base import Base
from app.models import ScoreLedger
from app.services.scoring import current_score


@pytest.mark.asyncio
async def test_score_ledger_and_clamp():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_maker() as session:
        # Initial score is 0
        assert await current_score(session, session_id=1) == 0

        # +10 for correct word
        session.add(
            ScoreLedger(
                session_id=1,
                event_id="ev-1",
                delta=10,
                reason_code="word",
                reason_key="word:entry-1",
                created_at=utcnow(),
            )
        )
        await session.commit()
        assert await current_score(session, session_id=1) == 10

        # -3 for hint letter
        session.add(
            ScoreLedger(
                session_id=1,
                event_id="ev-2",
                delta=-3,
                reason_code="hint_letter",
                reason_key="hint_letter:entry-2:0",
                created_at=utcnow(),
            )
        )
        await session.commit()
        assert await current_score(session, session_id=1) == 7

        # -10 for hint word
        session.add(
            ScoreLedger(
                session_id=1,
                event_id="ev-3",
                delta=-10,
                reason_code="hint_word",
                reason_key="hint_word:entry-3",
                created_at=utcnow(),
            )
        )
        await session.commit()
        # 10 - 3 - 10 = -3, clamped to 0!
        assert await current_score(session, session_id=1) == 0

        # +20 completion bonus
        session.add(
            ScoreLedger(
                session_id=1,
                event_id="ev-4",
                delta=20,
                reason_code="completion",
                reason_key="completion",
                created_at=utcnow(),
            )
        )
        await session.commit()
        # (-3) + 20 = 17
        assert await current_score(session, session_id=1) == 17

    await engine.dispose()
