from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select

from app.api.deps import (
    PlaytestCsrfDep,
    PlaytestSessionDep,
    SessionDep,
    SettingsDep,
    TeacherDep,
    CsrfDep,
    client_ip,
    require_origin,
    start_playtest_session,
)
from app.core.db_write import write_session
from app.core.errors import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.core.security import generate_code, hash_password, verify_password
from app.core.time import utcnow
from app.models import (
    GameEvent,
    GameSession,
    PlaytestLink,
    PuzzleSet,
    ScoreLedger,
    SessionEntry,
    SessionHint,
)
from app.schemas.game import PlayEventsRequest, PlaytestJoinRequest
from app.services.puzzle import mask_for_participant, parse_puzzle
from app.services.scoring import current_score

router = APIRouter(prefix="", tags=["playtest"])


# ==========================================
# TEACHER PLAYTEST ENDPOINTS
# ==========================================


@router.post("/teacher/playtest/{puzzle_id}/start")
async def start_teacher_playtest(
    puzzle_id: int,
    request: Request,
    response: Response,
    teacher: TeacherDep,
    session: SessionDep,
    settings: SettingsDep,
    _: CsrfDep,
) -> dict[str, Any]:
    puzzle = (
        await session.execute(
            select(PuzzleSet)
            .where(PuzzleSet.id == puzzle_id)
            .where(PuzzleSet.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not puzzle:
        raise NotFoundError("Puzzle tidak ditemukan.")

    parsed = parse_puzzle(puzzle.content_json)
    now = utcnow()

    gs = GameSession(
        competition_id=None,
        group_id=None,
        puzzle_set_id=puzzle.id,
        player_name=f"Guru: {teacher.name}",
        status="active",
        started_at=now,
        deadline_at=None,
        last_event_at=now,
        last_seen_at=now,
        last_seen_throttled_at=now,
        created_at=now,
    )
    session.add(gs)
    await session.flush()

    for entry in parsed.entries:
        se = SessionEntry(
            session_id=gs.id,
            entry_id=entry.entry_id,
            status="unsolved",
            attempts=0,
            updated_at=now,
        )
        session.add(se)

    await session.commit()
    await session.refresh(gs)

    await start_playtest_session(response, session, gs, settings)

    return {
        "status": "playing",
        "session_id": gs.id,
        "puzzle": {"title": parsed.title},
    }


@router.post("/teacher/playtest/{puzzle_id}/share")
async def create_share_link(
    puzzle_id: int,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    settings: SettingsDep,
    _: CsrfDep,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    puzzle = (
        await session.execute(
            select(PuzzleSet)
            .where(PuzzleSet.id == puzzle_id)
            .where(PuzzleSet.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not puzzle:
        raise NotFoundError("Puzzle tidak ditemukan.")
    if puzzle.status != "published":
        raise ValidationError("Hanya puzzle yang sudah dipublikasi yang dapat dibagikan.")

    pin_value = None
    if isinstance(body, dict):
        pin_value = (body.get("pin") or "").strip() or None
    pin_hash = hash_password(pin_value) if pin_value else None

    share_code = ""
    for _ in range(10):
        cand = generate_code(settings.competition_code_len)
        exists = (
            await session.execute(
                select(PlaytestLink).where(PlaytestLink.share_code == cand)
            )
        ).scalar_one_or_none()
        if not exists:
            share_code = cand
            break
    if not share_code:
        raise ConflictError("Gagal menghasilkan kode share yang unik.")

    link = PlaytestLink(
        teacher_id=teacher.id,
        puzzle_set_id=puzzle.id,
        share_code=share_code,
        pin_hash=pin_hash,
        is_active=True,
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    session.add(link)
    await session.commit()
    await session.refresh(link)

    return {
        "id": link.id,
        "share_code": link.share_code,
        "pin": pin_value,
        "share_url": f"{settings.public_app_url}/playtest?code={link.share_code}",
        "puzzle_title": puzzle.title,
        "puzzle_id": puzzle.id,
        "is_active": link.is_active,
        "created_at": link.created_at.isoformat(),
    }


@router.get("/teacher/playtest/links")
async def list_share_links(
    teacher: TeacherDep,
    session: SessionDep,
    settings: SettingsDep,
) -> dict[str, Any]:
    stmt = (
        select(PlaytestLink, PuzzleSet)
        .join(PuzzleSet, PuzzleSet.id == PlaytestLink.puzzle_set_id)
        .where(PlaytestLink.teacher_id == teacher.id)
        .order_by(PlaytestLink.created_at.desc())
    )
    rows = (await session.execute(stmt)).all()

    return {
        "links": [
            {
                "id": link.id,
                "share_code": link.share_code,
                "share_url": f"{settings.public_app_url}/playtest?code={link.share_code}",
                "puzzle_title": puzzle.title,
                "puzzle_id": puzzle.id,
                "is_active": link.is_active,
                "created_at": link.created_at.isoformat(),
            }
            for link, puzzle in rows
        ]
    }


@router.delete("/teacher/playtest/links/{link_id}")
async def delete_share_link(
    link_id: int,
    teacher: TeacherDep,
    session: SessionDep,
    _: CsrfDep,
) -> dict[str, Any]:
    link = (
        await session.execute(
            select(PlaytestLink)
            .where(PlaytestLink.id == link_id)
            .where(PlaytestLink.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not link:
        raise NotFoundError("Link playtest tidak ditemukan.")

    await session.delete(link)
    await session.commit()
    return {"ok": True}


# ==========================================
# PUBLIC PLAYTEST ENDPOINTS
# ==========================================


@router.post("/playtest/{share_code}/join")
async def join_playtest(
    share_code: str,
    body: PlaytestJoinRequest = PlaytestJoinRequest(),
    request: Request = None,
    response: Response = None,
    session: SessionDep = None,
    settings: SettingsDep = None,
    _: None = Depends(require_origin),
) -> dict[str, Any]:
    code = share_code.strip().upper()
    link = (
        await session.execute(
            select(PlaytestLink).where(PlaytestLink.share_code == code)
        )
    ).scalar_one_or_none()
    if not link:
        raise NotFoundError("Kode playtest tidak ditemukan.")
    if not link.is_active:
        raise ForbiddenError("Link playtest ini telah dinonaktifkan.")

    puzzle = (
        await session.execute(
            select(PuzzleSet).where(PuzzleSet.id == link.puzzle_set_id)
        )
    ).scalar_one_or_none()
    if not puzzle:
        raise NotFoundError("Puzzle tidak ditemukan.")
    parsed = parse_puzzle(puzzle.content_json)
    now = utcnow()

    player_name = (body.player_name or "").strip()[:120] if body.player_name else "Player"

    gs = GameSession(
        competition_id=None,
        group_id=None,
        puzzle_set_id=puzzle.id,
        player_name=player_name,
        status="active",
        started_at=now,
        deadline_at=None,
        last_event_at=now,
        last_seen_at=now,
        last_seen_throttled_at=now,
        created_at=now,
    )
    session.add(gs)
    await session.flush()

    for entry in parsed.entries:
        se = SessionEntry(
            session_id=gs.id,
            entry_id=entry.entry_id,
            status="unsolved",
            attempts=0,
            updated_at=now,
        )
        session.add(se)

    await session.commit()
    await session.refresh(gs)

    await start_playtest_session(response, session, gs, settings)

    return {
        "status": "playing",
        "session_id": gs.id,
        "puzzle": {"title": parsed.title},
        "player_name": player_name,
    }


@router.get("/playtest/state")
async def get_playtest_state(
    playtest_session: PlaytestSessionDep,
    session: SessionDep,
) -> dict[str, Any]:
    gs = playtest_session

    puzzle = (
        await session.execute(select(PuzzleSet).where(PuzzleSet.id == gs.puzzle_set_id))
    ).scalar_one()
    parsed = parse_puzzle(puzzle.content_json)
    mask = mask_for_participant(parsed)

    now = utcnow()
    if (now - gs.last_seen_throttled_at).total_seconds() >= 15:
        gs.last_seen_at = now
        gs.last_seen_throttled_at = now
        await session.commit()

    se_list = (
        await session.execute(
            select(SessionEntry).where(SessionEntry.session_id == gs.id)
        )
    ).scalars().all()
    entries_by_id = {se.entry_id: se for se in se_list}

    sh_list = (
        await session.execute(
            select(SessionHint).where(SessionHint.session_id == gs.id)
        )
    ).scalars().all()
    revealed_letter_hints = {
        (sh.entry_id, sh.cell_index): True for sh in sh_list if sh.hint_type == "letter"
    }

    grid_revealed: dict[tuple[int, int], str] = {}
    for entry in parsed.entries:
        se = entries_by_id.get(entry.entry_id)
        if not se:
            continue
        if se.status in ("solved", "assisted"):
            for idx, (r, c) in enumerate(entry.cells):
                grid_revealed[(r, c)] = entry.answer[idx]
        else:
            for idx, (r, c) in enumerate(entry.cells):
                if (entry.entry_id, idx) in revealed_letter_hints:
                    grid_revealed[(r, c)] = entry.answer[idx]

    cells_out = []
    for cell in mask["cells"]:
        r, c = cell["row"], cell["col"]
        cell_dict = dict(cell)
        if (r, c) in grid_revealed:
            cell_dict["letter"] = grid_revealed[(r, c)]
            cell_dict["locked"] = True
        else:
            cell_dict["letter"] = None
            cell_dict["locked"] = False
        cells_out.append(cell_dict)

    entries_out = []
    for e in mask["entries"]:
        se = entries_by_id.get(e["id"])
        e_dict = dict(e)
        e_dict["status"] = se.status if se else "unsolved"
        e_dict["attempts"] = se.attempts if se else 0
        entry_hints = [sh for sh in sh_list if sh.entry_id == e["id"] and sh.hint_type == "letter"]
        e_dict["hints_used"] = len(entry_hints)
        entries_out.append(e_dict)

    score = await current_score(session, gs.id)

    return {
        "status": gs.status,
        "score": score,
        "puzzle_title": parsed.title,
        "player_name": gs.player_name,
        "started_at": gs.started_at.isoformat() if gs.started_at else None,
        "server_now": now.isoformat(),
        "server_now_ms": int(now.timestamp() * 1000),
        "puzzle": {
            "title": parsed.title,
            "rows": mask["rows"],
            "cols": mask["cols"],
            "cells": cells_out,
            "entries": entries_out,
        },
    }


@router.post("/playtest/events")
async def playtest_events(
    body: PlayEventsRequest,
    playtest_session: PlaytestSessionDep,
    session: SessionDep,
    _: PlaytestCsrfDep,
) -> dict[str, Any]:
    gs = playtest_session
    now = utcnow()

    if gs.status != "active":
        score = await current_score(session, gs.id)
        return {
            "results": [
                {"event_id": ev.event_id, "accepted": True, "reject_reason": None, "result": {}}
                for ev in body.events
            ],
            "score": score,
            "status": gs.status,
        }

    results: list[dict[str, Any]] = []

    async with write_session() as write_s:
        gs_row = (
            await write_s.execute(select(GameSession).where(GameSession.id == gs.id))
        ).scalar_one()

        puzzle = (
            await write_s.execute(select(PuzzleSet).where(PuzzleSet.id == gs.puzzle_set_id))
        ).scalar_one()
        parsed = parse_puzzle(puzzle.content_json)

        se_rows = (
            await write_s.execute(
                select(SessionEntry).where(SessionEntry.session_id == gs.id)
            )
        ).scalars().all()
        entries_by_id = {se.entry_id: se for se in se_rows}

        for ev in body.events:
            event_id = ev.event_id.strip()

            existing_ev = (
                await write_s.execute(
                    select(GameEvent)
                    .where(GameEvent.session_id == gs.id)
                    .where(GameEvent.event_id == event_id)
                )
            ).scalar_one_or_none()
            if existing_ev:
                results.append(
                    {
                        "event_id": event_id,
                        "accepted": existing_ev.accepted,
                        "reject_reason": existing_ev.reject_reason,
                        "result": existing_ev.result_json,
                    }
                )
                continue

            ev_type = ev.type.strip()
            payload = ev.payload

            if ev_type == "word_submit":
                entry_id = payload.get("entry_id")
                letters = str(payload.get("letters", "")).strip().upper()
                entry = parsed.entry_by_id(entry_id)
                se = entries_by_id.get(entry_id)

                if not entry or not se:
                    res = {"accepted": False, "reject_reason": "Entry tidak ditemukan.", "result": {}}
                elif se.status in ("solved", "assisted"):
                    res = {
                        "accepted": True,
                        "reject_reason": None,
                        "result": {
                            "already_solved": True,
                            "correct": True,
                            "entry_id": entry_id,
                            "answer": entry.answer,
                        },
                    }
                else:
                    if letters == entry.answer:
                        reason_key = f"word:{entry_id}"
                        write_s.add(
                            ScoreLedger(
                                session_id=gs.id,
                                event_id=event_id,
                                delta=10,
                                reason_code="word",
                                reason_key=reason_key,
                                created_at=now,
                            )
                        )
                        se.status = "solved"
                        se.solved_at = now
                        se.updated_at = now
                        res = {
                            "accepted": True,
                            "reject_reason": None,
                            "result": {"correct": True, "entry_id": entry_id, "answer": entry.answer},
                        }
                    else:
                        se.attempts += 1
                        se.updated_at = now
                        res = {
                            "accepted": True,
                            "reject_reason": None,
                            "result": {"correct": False, "entry_id": entry_id},
                        }

            elif ev_type == "hint_letter":
                entry_id = payload.get("entry_id")
                cell_index = payload.get("cell_index")
                entry = parsed.entry_by_id(entry_id)
                se = entries_by_id.get(entry_id)

                if not entry or not se or not isinstance(cell_index, int):
                    res = {"accepted": False, "reject_reason": "Parameter hint letter tidak valid.", "result": {}}
                elif se.status in ("solved", "assisted"):
                    res = {"accepted": False, "reject_reason": "Entry sudah diselesaikan.", "result": {}}
                elif not (0 <= cell_index < len(entry.answer)):
                    res = {"accepted": False, "reject_reason": "Index cell di luar rentang kata.", "result": {}}
                else:
                    hint_count = (
                        await write_s.execute(
                            select(func.count(SessionHint.id))
                            .where(SessionHint.session_id == gs.id)
                            .where(SessionHint.entry_id == entry_id)
                            .where(SessionHint.hint_type == "letter")
                        )
                    ).scalar_one()

                    if hint_count >= 2:
                        res = {"accepted": False, "reject_reason": "Batas hint huruf per kata (maks 2) telah tercapai.", "result": {}}
                    else:
                        hint_key = f"hint_letter:{entry_id}:{cell_index}"
                        already_hinted = (
                            await write_s.execute(
                                select(SessionHint)
                                .where(SessionHint.session_id == gs.id)
                                .where(SessionHint.hint_key == hint_key)
                            )
                        ).scalar_one_or_none()
                        if already_hinted:
                            res = {
                                "accepted": True,
                                "reject_reason": None,
                                "result": {"cell_index": cell_index, "letter": entry.answer[cell_index]},
                            }
                        else:
                            write_s.add(
                                SessionHint(
                                    session_id=gs.id,
                                    entry_id=entry_id,
                                    hint_key=hint_key,
                                    hint_type="letter",
                                    cell_index=cell_index,
                                    created_at=now,
                                )
                            )
                            write_s.add(
                                ScoreLedger(
                                    session_id=gs.id,
                                    event_id=event_id,
                                    delta=-3,
                                    reason_code="hint_letter",
                                    reason_key=hint_key,
                                    created_at=now,
                                )
                            )
                            res = {
                                "accepted": True,
                                "reject_reason": None,
                                "result": {"cell_index": cell_index, "letter": entry.answer[cell_index]},
                            }

            elif ev_type == "hint_word":
                entry_id = payload.get("entry_id")
                entry = parsed.entry_by_id(entry_id)
                se = entries_by_id.get(entry_id)

                if not entry or not se:
                    res = {"accepted": False, "reject_reason": "Entry tidak ditemukan.", "result": {}}
                elif se.status in ("solved", "assisted"):
                    res = {"accepted": False, "reject_reason": "Kata sudah terbuka atau dibantu.", "result": {}}
                else:
                    hint_key = f"hint_word:{entry_id}"
                    write_s.add(
                        SessionHint(
                            session_id=gs.id,
                            entry_id=entry_id,
                            hint_key=hint_key,
                            hint_type="word",
                            cell_index=None,
                            created_at=now,
                        )
                    )
                    write_s.add(
                        ScoreLedger(
                            session_id=gs.id,
                            event_id=event_id,
                            delta=-10,
                            reason_code="hint_word",
                            reason_key=hint_key,
                            created_at=now,
                        )
                    )
                    se.status = "assisted"
                    se.updated_at = now
                    res = {
                        "accepted": True,
                        "reject_reason": None,
                        "result": {"entry_id": entry_id, "answer": entry.answer},
                    }
            else:
                res = {"accepted": False, "reject_reason": f"Tipe event '{ev_type}' tidak dikenal.", "result": {}}

            game_ev = GameEvent(
                session_id=gs.id,
                event_id=event_id,
                seq_client=ev.seq,
                type=ev_type,
                payload_json=payload,
                result_json=res.get("result", {}),
                accepted=res["accepted"],
                reject_reason=res.get("reject_reason"),
                created_at=now,
            )
            write_s.add(game_ev)
            results.append({"event_id": event_id, **res})

        all_completed = all(se.status in ("solved", "assisted") for se in entries_by_id.values())
        if all_completed and gs_row.status == "active":
            comp_ledger_exists = (
                await write_s.execute(
                    select(ScoreLedger)
                    .where(ScoreLedger.session_id == gs.id)
                    .where(ScoreLedger.reason_key == "completion")
                )
            ).scalar_one_or_none()
            if not comp_ledger_exists:
                write_s.add(
                    ScoreLedger(
                        session_id=gs.id,
                        event_id=None,
                        delta=20,
                        reason_code="completion",
                        reason_key="completion",
                        created_at=now,
                    )
                )
                gs_row.status = "completed"
                gs_row.completed_at = now

        gs_row.last_event_at = now
        await write_s.flush()
        score = await current_score(write_s, gs.id)
        current_status = gs_row.status

    return {"results": results, "score": score, "status": current_status}


@router.post("/playtest/finish")
async def finish_playtest(
    playtest_session: PlaytestSessionDep,
    session: SessionDep,
    _: PlaytestCsrfDep,
) -> dict[str, Any]:
    gs = playtest_session
    now = utcnow()
    if gs.status == "active":
        gs.status = "completed"
        if not gs.completed_at:
            gs.completed_at = now
        await session.commit()
    return {"status": "completed"}


@router.get("/playtest/result")
async def get_playtest_result(
    playtest_session: PlaytestSessionDep,
    session: SessionDep,
) -> dict[str, Any]:
    gs = playtest_session

    puzzle = (
        await session.execute(select(PuzzleSet).where(PuzzleSet.id == gs.puzzle_set_id))
    ).scalar_one()
    parsed = parse_puzzle(puzzle.content_json)

    score = await current_score(session, gs.id)

    solved_count = (
        await session.execute(
            select(func.count(SessionEntry.id))
            .where(SessionEntry.session_id == gs.id)
            .where(SessionEntry.status.in_(("solved", "assisted")))
        )
    ).scalar_one()

    total_entries = len(parsed.entries)
    hints_count = (
        await session.execute(
            select(func.count(SessionHint.id)).where(SessionHint.session_id == gs.id)
        )
    ).scalar_one()

    dur_sec = None
    if gs.completed_at and gs.started_at:
        dur_sec = max(0, int((gs.completed_at - gs.started_at).total_seconds()))
    elif gs.started_at and gs.last_event_at:
        dur_sec = max(0, int((gs.last_event_at - gs.started_at).total_seconds()))

    return {
        "player_name": gs.player_name,
        "puzzle_title": parsed.title,
        "status": gs.status,
        "score": score,
        "solved_count": solved_count,
        "total_entries": total_entries,
        "hints_used": hints_count,
        "started_at": gs.started_at.isoformat() if gs.started_at else None,
        "completed_at": gs.completed_at.isoformat() if gs.completed_at else None,
        "duration_seconds": dur_sec,
    }
