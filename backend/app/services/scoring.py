from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ScoreLedger

WORD_POINTS = 10
HINT_LETTER_COST = 3
HINT_WORD_COST = 10
COMPLETION_BONUS = 20


async def current_score(session: AsyncSession, session_id: int) -> int:
    total = (
        await session.execute(
            select(func.coalesce(func.sum(ScoreLedger.delta), 0)).where(
                ScoreLedger.session_id == session_id
            )
        )
    ).scalar_one()
    return max(0, int(total))


async def max0(score: int) -> int:
    return max(0, score)
