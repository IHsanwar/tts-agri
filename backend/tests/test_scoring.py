from __future__ import annotations

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.time import utcnow
from app.models import Competition, GameSession, Group, PuzzleSet, ScoreLedger, Teacher
from app.services.scoring import current_score


@pytest.mark.asyncio
async def test_score_ledger_and_clamp():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_maker() as session:
        # 1. Create teacher
        teacher = Teacher(
            email=f"test_scoring_{int(utcnow().timestamp())}@school.id",
            password_hash="testhash",
            name="Guru Test Scoring",
            is_active=True,
            created_at=utcnow(),
        )
        session.add(teacher)
        await session.flush()

        # 2. Create puzzle
        puzzle = PuzzleSet(
            teacher_id=teacher.id,
            version=f"v-test-{int(utcnow().timestamp())}",
            schema_version=1,
            title="Test Scoring Puzzle",
            content_json={"grid": ["CAT"], "entries": []},
            sha256="dummy_sha256",
            status="published",
            created_at=utcnow(),
        )
        session.add(puzzle)
        await session.flush()

        # 3. Create group
        group = Group(
            teacher_id=teacher.id,
            group_code=f"G{int(utcnow().timestamp()) % 1000:03d}",
            name="Kelompok Test",
            pin_hash="pinhash",
            status="active",
            created_at=utcnow(),
        )
        session.add(group)
        await session.flush()

        # 4. Create competition
        comp = Competition(
            teacher_id=teacher.id,
            name="Kompetisi Test",
            join_code=f"C{int(utcnow().timestamp()) % 100000:05d}",
            status="running",
            puzzle_set_id=puzzle.id,
            duration_minutes=15,
            created_at=utcnow(),
        )
        session.add(comp)
        await session.flush()

        # 5. Create game session
        gs = GameSession(
            competition_id=comp.id,
            group_id=group.id,
            status="active",
            started_at=utcnow(),
            created_at=utcnow(),
        )
        session.add(gs)
        await session.commit()
        await session.refresh(gs)

        session_id = gs.id

        try:
            # Initial score is 0
            assert await current_score(session, session_id=session_id) == 0

            # +10 for correct word
            session.add(
                ScoreLedger(
                    session_id=session_id,
                    event_id="ev-1",
                    delta=10,
                    reason_code="word",
                    reason_key="word:entry-1",
                    created_at=utcnow(),
                )
            )
            await session.commit()
            assert await current_score(session, session_id=session_id) == 10

            # -3 for hint letter
            session.add(
                ScoreLedger(
                    session_id=session_id,
                    event_id="ev-2",
                    delta=-3,
                    reason_code="hint_letter",
                    reason_key="hint_letter:entry-2:0",
                    created_at=utcnow(),
                )
            )
            await session.commit()
            assert await current_score(session, session_id=session_id) == 7

            # -10 for hint word
            session.add(
                ScoreLedger(
                    session_id=session_id,
                    event_id="ev-3",
                    delta=-10,
                    reason_code="hint_word",
                    reason_key="hint_word:entry-3",
                    created_at=utcnow(),
                )
            )
            await session.commit()
            # 10 - 3 - 10 = -3, clamped to 0!
            assert await current_score(session, session_id=session_id) == 0

            # +20 completion bonus
            session.add(
                ScoreLedger(
                    session_id=session_id,
                    event_id="ev-4",
                    delta=20,
                    reason_code="completion",
                    reason_key="completion",
                    created_at=utcnow(),
                )
            )
            await session.commit()
            # (-3) + 20 = 17
            assert await current_score(session, session_id=session_id) == 17
        finally:
            # Cleanup test hierarchy via CASCADE
            await session.delete(teacher)
            await session.commit()

    await engine.dispose()
