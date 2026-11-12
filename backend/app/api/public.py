from __future__ import annotations

from datetime import timedelta
from typing import Any

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import SessionDep
from app.core.errors import ForbiddenError, NotFoundError
from app.core.time import utcnow
from app.models import Competition, GameSession, Group
from app.services.scoring import current_score

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/competitions/{join_code}/leaderboard")
async def get_public_leaderboard(
    join_code: str,
    session: SessionDep,
) -> dict[str, Any]:
    comp_code = join_code.strip().upper()
    comp = (
        await session.execute(select(Competition).where(Competition.join_code == comp_code))
    ).scalar_one_or_none()
    if not comp:
        raise NotFoundError("Kompetisi tidak ditemukan.")

    if not comp.leaderboard_public:
        raise ForbiddenError("Leaderboard publik tidak diaktifkan untuk kompetisi ini.")

    stmt = (
        select(GameSession, Group)
        .join(Group, Group.id == GameSession.group_id)
        .where(GameSession.competition_id == comp.id)
        .where(GameSession.status != "voided")
    )
    rows = (await session.execute(stmt)).all()

    entries = []
    for gs, g in rows:
        sc = await current_score(session, gs.id)
        dur = None
        if gs.completed_at and gs.started_at:
            dur = int((gs.completed_at - gs.started_at).total_seconds())
        entries.append(
            {
                "group_name": g.name,
                "group_code": g.group_code,
                "score": sc,
                "status": gs.status,
                "completed_at": gs.completed_at.isoformat() if gs.completed_at else None,
                "duration_seconds": dur,
                "_raw_completed": gs.completed_at,
            }
        )

    # Sort: score DESC, completed_at ASC (nulls last), group_name ASC
    far_future = utcnow() + timedelta(days=3650)
    entries.sort(
        key=lambda x: (
            -x["score"],
            x["_raw_completed"] or far_future,
            x["group_name"],
        )
    )

    for idx, e in enumerate(entries, 1):
        e["rank"] = idx
        del e["_raw_completed"]

    return {
        "competition_name": comp.name,
        "status": comp.status,
        "is_final": comp.status == "closed",
        "leaderboard": entries,
    }
