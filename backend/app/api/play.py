from __future__ import annotations

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select, update
from starlette.concurrency import run_in_threadpool

from app.api.deps import (
    GroupCsrfDep,
    GroupSessionDep,
    SessionDep,
    SettingsDep,
    client_ip,
    require_origin,
    start_group_session,
)
from app.core.db_write import write_session
from app.core.errors import (
    AuthError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)
from app.core.rate_limit import _events_session, _join_group, _join_ip, _wrong_session
from app.core.security import verify_password
from app.core.time import utcnow
from app.models import (
    Competition,
    CompetitionGroup,
    GameEvent,
    GameSession,
    Group,
    JoinAttempt,
    PuzzleSet,
    ScoreLedger,
    SessionEntry,
    SessionHint,
)
from app.schemas.game import JoinRequest, PlayEventsRequest
from app.services.puzzle import mask_for_participant, parse_puzzle
from app.services.scoring import current_score

router = APIRouter(prefix="", tags=["play"])


@router.post("/join")
async def join_competition(
    body: JoinRequest,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
    _: None = Depends(require_origin),
) -> dict[str, Any]:
    ip = client_ip(request)
    comp_code = body.competition_code.strip().upper()
    grp_code = body.group_code.strip().upper()

    if not _join_ip.allow(ip):
        session.add(JoinAttempt(competition_code=comp_code, group_code=grp_code, ip=ip, success=False))
        await session.commit()
        raise RateLimitError("Terlalu banyak percobaan join dari alamat IP ini.")

    if not _join_group.allow(f"{comp_code}:{grp_code}"):
        session.add(JoinAttempt(competition_code=comp_code, group_code=grp_code, ip=ip, success=False))
        await session.commit()
        raise RateLimitError("Terlalu banyak percobaan login untuk grup ini.")

    comp = (
        await session.execute(select(Competition).where(Competition.join_code == comp_code))
    ).scalar_one_or_none()
    if not comp:
        session.add(JoinAttempt(competition_code=comp_code, group_code=grp_code, ip=ip, success=False))
        await session.commit()
        raise NotFoundError("Kode kompetisi tidak ditemukan.")

    group = (
        await session.execute(
            select(Group)
            .where(Group.teacher_id == comp.teacher_id)
            .where(Group.group_code == grp_code)
        )
    ).scalar_one_or_none()
    if not group:
        session.add(JoinAttempt(competition_code=comp_code, group_code=grp_code, ip=ip, success=False))
        await session.commit()
        raise NotFoundError("Kode grup tidak ditemukan untuk kompetisi ini.")

    if group.status != "active":
        session.add(JoinAttempt(competition_code=comp_code, group_code=grp_code, ip=ip, success=False))
        await session.commit()
        raise ForbiddenError("Grup dinonaktifkan.")

    valid_pin = await run_in_threadpool(verify_password, body.pin.strip(), group.pin_hash)
    if not valid_pin:
        session.add(JoinAttempt(competition_code=comp_code, group_code=grp_code, ip=ip, success=False))
        await session.commit()
        raise AuthError("PIN grup tidak valid.")

    cg = (
        await session.execute(
            select(CompetitionGroup)
            .where(CompetitionGroup.competition_id == comp.id)
            .where(CompetitionGroup.group_id == group.id)
        )
    ).scalar_one_or_none()
    if not cg:
        session.add(JoinAttempt(competition_code=comp_code, group_code=grp_code, ip=ip, success=False))
        await session.commit()
        raise NotFoundError("Grup ini tidak terdaftar dalam kompetisi.")

    # Record success join attempt
    session.add(JoinAttempt(competition_code=comp_code, group_code=grp_code, ip=ip, success=True))
    await session.commit()

    if comp.status == "draft":
        raise ConflictError("Kompetisi belum dibuka oleh guru.")

    if comp.status == "open":
        # Group joins waiting room
        await start_group_session(response, session, cg, settings)
        return {
            "status": "waiting",
            "competition": {"name": comp.name, "status": comp.status},
            "group": {"name": group.name, "code": group.group_code},
        }

    if comp.status == "running":
        if cg.status in ("joined", "in_progress"):
            # Resume & Takeover session!
            await start_group_session(response, session, cg, settings)
            return {
                "status": "playing",
                "competition": {"name": comp.name, "status": comp.status},
                "group": {"name": group.name, "code": group.group_code},
            }
        if cg.status == "disqualified":
            raise ForbiddenError("Grup telah didiskualifikasi dari kompetisi ini.")
        raise ConflictError("Kompetisi sedang berjalan dan grup belum bergabung sebelum mulai.")

    if comp.status == "closed":
        await start_group_session(response, session, cg, settings)
        return {
            "status": "closed",
            "competition": {"name": comp.name, "status": comp.status},
            "group": {"name": group.name, "code": group.group_code},
        }

    raise ConflictError(f"Status kompetisi tidak valid: {comp.status}")


@router.get("/play/state")
async def get_play_state(
    group_session: GroupSessionDep,
    session: SessionDep,
) -> dict[str, Any]:
    cg, gs = group_session

    comp = (
        await session.execute(select(Competition).where(Competition.id == cg.competition_id))
    ).scalar_one()

    group = (
        await session.execute(select(Group).where(Group.id == cg.group_id))
    ).scalar_one()

    if not gs or comp.status == "open":
        return {
            "status": "waiting",
            "competition": {"name": comp.name, "status": comp.status},
            "group": {"name": group.name, "code": group.group_code},
            "server_now": utcnow().isoformat(),
            "server_now_ms": int(utcnow().timestamp() * 1000),
        }

    # Throttle last_seen_at
    now = utcnow()
    if (now - gs.last_seen_throttled_at).total_seconds() >= 15:
        gs.last_seen_at = now
        gs.last_seen_throttled_at = now
        await session.commit()

    # Check deadline
    if gs.status == "active" and gs.deadline_at and now >= gs.deadline_at:
        gs.status = "expired"
        await session.commit()

    puzzle = (
        await session.execute(select(PuzzleSet).where(PuzzleSet.id == comp.puzzle_set_id))
    ).scalar_one()
    parsed = parse_puzzle(puzzle.content_json)
    mask = mask_for_participant(parsed)

    # Load session entries
    entries_stmt = select(SessionEntry).where(SessionEntry.session_id == gs.id)
    se_list = (await session.execute(entries_stmt)).scalars().all()
    entries_by_id = {se.entry_id: se for se in se_list}

    # Load hints
    hints_stmt = select(SessionHint).where(SessionHint.session_id == gs.id)
    sh_list = (await session.execute(hints_stmt)).scalars().all()
    revealed_letter_hints = {
        (sh.entry_id, sh.cell_index): True for sh in sh_list if sh.hint_type == "letter"
    }

    # Map grid cell revealed letters
    grid_revealed: dict[tuple[int, int], str] = {}
    for entry in parsed.entries:
        se = entries_by_id.get(entry.entry_id)
        if not se:
            continue
        if se.status in ("solved", "assisted"):
            for idx, (r, c) in enumerate(entry.cells):
                grid_revealed[(r, c)] = entry.answer[idx]
        else:
            # Letter hints
            for idx, (r, c) in enumerate(entry.cells):
                if (entry.entry_id, idx) in revealed_letter_hints:
                    grid_revealed[(r, c)] = entry.answer[idx]

    # Annotate cells with revealed letters
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

    # Annotate entries
    entries_out = []
    for e in mask["entries"]:
        se = entries_by_id.get(e["id"])
        e_dict = dict(e)
        e_dict["status"] = se.status if se else "unsolved"
        e_dict["attempts"] = se.attempts if se else 0
        # Count letter hints
        entry_hints = [sh for sh in sh_list if sh.entry_id == e["id"] and sh.hint_type == "letter"]
        e_dict["hints_used"] = len(entry_hints)
        entries_out.append(e_dict)

    score = await current_score(session, gs.id)

    return {
        "status": gs.status,
        "score": score,
        "competition": {"name": comp.name, "status": comp.status},
        "group": {"name": group.name, "code": group.group_code},
        "started_at": gs.started_at.isoformat() if gs.started_at else None,
        "deadline_at": gs.deadline_at.isoformat() if gs.deadline_at else None,
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


@router.post("/play/events")
async def play_events(
    body: PlayEventsRequest,
    group_session: GroupSessionDep,
    _: GroupCsrfDep,
) -> dict[str, Any]:
    cg, gs = group_session
    if not gs:
        raise ConflictError("Sesi game belum dimulai.")

    now = utcnow()
    if gs.status != "active":
        raise ConflictError(f"Sesi game tidak aktif (status: {gs.status}).")

    if gs.deadline_at and now >= gs.deadline_at:
        raise ConflictError("Waktu permainan telah berakhir.")

    if not _events_session.allow(str(gs.id), amount=len(body.events)):
        raise RateLimitError("Terlalu banyak permintaan event. Harap tunggu sebentar.")

    results: list[dict[str, Any]] = []

    async with write_session() as write_s:
        # Load puzzle
        comp = (
            await write_s.execute(select(Competition).where(Competition.id == gs.competition_id))
        ).scalar_one()
        puzzle = (
            await write_s.execute(select(PuzzleSet).where(PuzzleSet.id == comp.puzzle_set_id))
        ).scalar_one()
        parsed = parse_puzzle(puzzle.content_json)

        # Load session entries
        se_rows = (
            await write_s.execute(
                select(SessionEntry).where(SessionEntry.session_id == gs.id)
            )
        ).scalars().all()
        entries_by_id = {se.entry_id: se for se in se_rows}

        for ev in body.events:
            event_id = ev.event_id.strip()

            # Check idempotency
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

            # Process event
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
                    res = {"accepted": True, "reject_reason": None, "result": {"already_solved": True}}
                else:
                    if letters == entry.answer:
                        # Correct! +10 pts
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
                        # Incorrect attempt
                        if not _wrong_session.allow(str(gs.id)):
                            raise RateLimitError("Terlalu banyak tebakan salah. Tunggu 1 menit.")
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
                    # Check max 2 letter hints per entry
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
                        # Check if already hinted this cell
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

            # Record event in game_events
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

        # Check completion condition: all entries solved or assisted
        all_completed = all(se.status in ("solved", "assisted") for se in entries_by_id.values())
        if all_completed and gs.status == "active":
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
                gs.status = "completed"
                gs.completed_at = now
                cg.status = "completed"
                cg.completed_at = now

        gs.last_event_at = now

    # Get updated score
    score = await current_score(session, gs.id)
    return {"results": results, "score": score, "status": gs.status}


@router.get("/play/result")
async def get_play_result(
    group_session: GroupSessionDep,
    session: SessionDep,
) -> dict[str, Any]:
    cg, gs = group_session
    if not gs:
        raise NotFoundError("Sesi game tidak ditemukan.")

    comp = (
        await session.execute(select(Competition).where(Competition.id == gs.competition_id))
    ).scalar_one()

    group = (
        await session.execute(select(Group).where(Group.id == gs.group_id))
    ).scalar_one()

    score = await current_score(session, gs.id)

    # Rank calculation
    all_sessions_stmt = (
        select(GameSession, Group)
        .join(Group, Group.id == GameSession.group_id)
        .where(GameSession.competition_id == comp.id)
    )
    rows = (await session.execute(all_sessions_stmt)).all()

    scores_list = []
    for s_item, g_item in rows:
        sc = await current_score(session, s_item.id)
        scores_list.append(
            {
                "session_id": s_item.id,
                "score": sc,
                "status": s_item.status,
                "completed_at": s_item.completed_at,
                "group_name": g_item.name,
            }
        )

    # Sort
    scores_list.sort(
        key=lambda x: (
            x["status"] == "voided",
            -x["score"],
            x["completed_at"] or utcnow() + timedelta(days=365),
            x["group_name"],
        )
    )

    rank = 1
    my_rank = None
    for idx, item in enumerate(scores_list):
        if item["session_id"] == gs.id:
            my_rank = rank if item["status"] != "voided" else None
            break
        if item["status"] != "voided":
            rank += 1

    dur_sec = None
    if gs.completed_at and gs.started_at:
        dur_sec = int((gs.completed_at - gs.started_at).total_seconds())

    return {
        "group_name": group.name,
        "group_code": group.group_code,
        "competition_name": comp.name,
        "status": gs.status,
        "score": score,
        "rank": my_rank,
        "total_groups": len([s for s in scores_list if s["status"] != "voided"]),
        "started_at": gs.started_at.isoformat() if gs.started_at else None,
        "completed_at": gs.completed_at.isoformat() if gs.completed_at else None,
        "duration_seconds": dur_sec,
    }
