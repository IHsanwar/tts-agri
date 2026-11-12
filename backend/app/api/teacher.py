from __future__ import annotations

import csv
import io
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select, update
from starlette.concurrency import run_in_threadpool

from app.api.deps import (
    CsrfDep,
    SessionDep,
    SettingsDep,
    TeacherDep,
    client_ip,
)
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.hashing import compute_sha256
from app.core.security import generate_code, generate_pin, hash_password
from app.core.time import utcnow
from app.models import (
    AuditLog,
    Competition,
    CompetitionGroup,
    GameSession,
    Group,
    PuzzleSet,
    ScoreLedger,
    SessionEntry,
    SessionHint,
)
from app.schemas.content import PuzzleContent
from app.schemas.teacher import (
    CompetitionCreate,
    CompetitionUpdate,
    ExtendRequest,
    GroupCreate,
    GroupUpdate,
    VoidRequest,
)
from app.services.audit import record_audit
from app.services.puzzle import parse_puzzle, validate_puzzle
from app.services.scoring import current_score

router = APIRouter(prefix="/teacher", tags=["teacher"])


# ==========================================
# PUZZLES
# ==========================================


@router.get("/puzzles")
async def list_puzzles(teacher: TeacherDep, session: SessionDep) -> dict[str, Any]:
    stmt = (
        select(PuzzleSet)
        .where(PuzzleSet.teacher_id == teacher.id)
        .order_by(PuzzleSet.created_at.desc())
    )
    puzzles = (await session.execute(stmt)).scalars().all()
    return {
        "puzzles": [
            {
                "id": p.id,
                "version": p.version,
                "title": p.title,
                "status": p.status,
                "sha256": p.sha256,
                "created_at": p.created_at.isoformat(),
                "published_at": p.published_at.isoformat() if p.published_at else None,
            }
            for p in puzzles
        ]
    }


@router.post("/puzzles")
async def create_puzzle(
    puzzle_data: dict[str, Any],
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    _: CsrfDep,
) -> dict[str, Any]:
    errors, warnings = validate_puzzle(puzzle_data)
    if errors:
        raise ValidationError("Puzzle tidak valid.", {"errors": errors, "warnings": warnings})

    version = puzzle_data.get("version", "").strip()
    title = puzzle_data.get("title", "").strip()
    sha = compute_sha256(puzzle_data)

    existing = (
        await session.execute(
            select(PuzzleSet)
            .where(PuzzleSet.teacher_id == teacher.id)
            .where(PuzzleSet.version == version)
        )
    ).scalar_one_or_none()

    if existing:
        if existing.status == "published":
            raise ConflictError("Versi puzzle yang sudah dipublikasi tidak dapat diubah.")
        # Update existing draft
        existing.title = title
        existing.content_json = puzzle_data
        existing.sha256 = sha
        await session.commit()
        await session.refresh(existing)
        target_id = existing.id
    else:
        new_puzzle = PuzzleSet(
            teacher_id=teacher.id,
            version=version,
            schema_version=puzzle_data.get("schema_version", 1),
            title=title,
            content_json=puzzle_data,
            sha256=sha,
            status="draft",
            created_at=utcnow(),
        )
        session.add(new_puzzle)
        await session.commit()
        await session.refresh(new_puzzle)
        target_id = new_puzzle.id

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="puzzle.upload",
        target_type="puzzle_set",
        target_id=str(target_id),
        metadata={"version": version, "sha256": sha},
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {
        "id": target_id,
        "version": version,
        "title": title,
        "status": "draft",
        "sha256": sha,
        "warnings": warnings,
    }


@router.get("/puzzles/{puzzle_id}")
async def get_puzzle(
    puzzle_id: int,
    teacher: TeacherDep,
    session: SessionDep,
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
    return {
        "id": puzzle.id,
        "version": puzzle.version,
        "title": puzzle.title,
        "status": puzzle.status,
        "sha256": puzzle.sha256,
        "created_at": puzzle.created_at.isoformat(),
        "published_at": puzzle.published_at.isoformat() if puzzle.published_at else None,
        "content": puzzle.content_json,
        "preview": {
            "rows": parsed.rows,
            "cols": parsed.cols,
            "cell_numbers": {f"{r},{c}": n for (r, c), n in parsed.cell_numbers.items()},
            "entries": [
                {
                    "id": e.entry_id,
                    "number": e.number,
                    "direction": e.direction,
                    "row": e.row,
                    "col": e.col,
                    "answer": e.answer,
                    "clue_en": e.clue_en,
                    "clue_id": e.clue_id,
                }
                for e in parsed.entries
            ],
        },
    }


@router.post("/puzzles/{puzzle_id}/publish")
async def publish_puzzle(
    puzzle_id: int,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
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

    if puzzle.status == "published":
        return {"id": puzzle.id, "status": "published", "published_at": puzzle.published_at.isoformat()}

    errors, warnings = validate_puzzle(puzzle.content_json)
    if errors:
        raise ValidationError("Puzzle tidak dapat dipublikasi karena terdapat error.", {"errors": errors})

    puzzle.status = "published"
    puzzle.published_at = utcnow()
    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="puzzle.publish",
        target_type="puzzle_set",
        target_id=str(puzzle.id),
        metadata={"version": puzzle.version},
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {
        "id": puzzle.id,
        "status": "published",
        "published_at": puzzle.published_at.isoformat(),
        "warnings": warnings,
    }


@router.delete("/puzzles/{puzzle_id}")
async def delete_puzzle(
    puzzle_id: int,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
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

    if puzzle.status == "published":
        raise ConflictError("Puzzle yang sudah dipublikasi tidak dapat dihapus.")

    used = (
        await session.execute(
            select(Competition).where(Competition.puzzle_set_id == puzzle_id)
        )
    ).first()
    if used:
        raise ConflictError("Puzzle digunakan oleh kompetisi.")

    await session.delete(puzzle)
    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="puzzle.delete",
        target_type="puzzle_set",
        target_id=str(puzzle_id),
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {"ok": True}


# ==========================================
# GROUPS
# ==========================================


@router.get("/groups")
async def list_groups(teacher: TeacherDep, session: SessionDep) -> dict[str, Any]:
    stmt = (
        select(Group)
        .where(Group.teacher_id == teacher.id)
        .order_by(Group.created_at.desc())
    )
    groups = (await session.execute(stmt)).scalars().all()
    return {
        "groups": [
            {
                "id": g.id,
                "group_code": g.group_code,
                "name": g.name,
                "status": g.status,
                "created_at": g.created_at.isoformat(),
            }
            for g in groups
        ]
    }


@router.post("/groups")
async def create_group(
    body: GroupCreate,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    settings: SettingsDep,
    _: CsrfDep,
) -> dict[str, Any]:
    # Generate unique group code for this teacher
    group_code = ""
    for _ in range(10):
        candidate = generate_code(settings.group_code_len)
        exists = (
            await session.execute(
                select(Group)
                .where(Group.teacher_id == teacher.id)
                .where(Group.group_code == candidate)
            )
        ).scalar_one_or_none()
        if not exists:
            group_code = candidate
            break
    if not group_code:
        raise ConflictError("Gagal menghasilkan kode grup yang unik.")

    pin = generate_pin(settings.group_pin_digits)
    pin_h = await run_in_threadpool(hash_password, pin)

    group = Group(
        teacher_id=teacher.id,
        group_code=group_code,
        name=body.name.strip(),
        pin_hash=pin_h,
        status="active",
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    session.add(group)
    await session.commit()
    await session.refresh(group)

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="group.create",
        target_type="group",
        target_id=str(group.id),
        metadata={"group_code": group.group_code, "name": group.name},
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {
        "id": group.id,
        "group_code": group.group_code,
        "name": group.name,
        "pin": pin,  # shown ONCE to teacher
        "status": group.status,
        "created_at": group.created_at.isoformat(),
    }


@router.patch("/groups/{group_id}")
async def update_group(
    group_id: int,
    body: GroupUpdate,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    _: CsrfDep,
) -> dict[str, Any]:
    group = (
        await session.execute(
            select(Group)
            .where(Group.id == group_id)
            .where(Group.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not group:
        raise NotFoundError("Grup tidak ditemukan.")

    if body.name is not None:
        group.name = body.name.strip()
    if body.status is not None:
        if body.status not in ("active", "disabled"):
            raise ValidationError("Status harus 'active' atau 'disabled'.")
        group.status = body.status
    group.updated_at = utcnow()
    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="group.update",
        target_type="group",
        target_id=str(group.id),
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {
        "id": group.id,
        "group_code": group.group_code,
        "name": group.name,
        "status": group.status,
    }


@router.post("/groups/{group_id}/reset-pin")
async def reset_group_pin(
    group_id: int,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    settings: SettingsDep,
    _: CsrfDep,
) -> dict[str, Any]:
    group = (
        await session.execute(
            select(Group)
            .where(Group.id == group_id)
            .where(Group.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not group:
        raise NotFoundError("Grup tidak ditemukan.")

    pin = generate_pin(settings.group_pin_digits)
    pin_h = await run_in_threadpool(hash_password, pin)
    group.pin_hash = pin_h
    group.updated_at = utcnow()
    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="group.reset_pin",
        target_type="group",
        target_id=str(group.id),
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {
        "id": group.id,
        "group_code": group.group_code,
        "name": group.name,
        "pin": pin,
    }


# ==========================================
# COMPETITIONS
# ==========================================


@router.get("/competitions")
async def list_competitions(teacher: TeacherDep, session: SessionDep) -> dict[str, Any]:
    stmt = (
        select(Competition)
        .where(Competition.teacher_id == teacher.id)
        .order_by(Competition.created_at.desc())
    )
    comps = (await session.execute(stmt)).scalars().all()
    return {
        "competitions": [
            {
                "id": c.id,
                "name": c.name,
                "join_code": c.join_code,
                "status": c.status,
                "puzzle_set_id": c.puzzle_set_id,
                "duration_minutes": c.duration_minutes,
                "leaderboard_public": c.leaderboard_public,
                "created_at": c.created_at.isoformat(),
                "started_at": c.started_at.isoformat() if c.started_at else None,
                "closed_at": c.closed_at.isoformat() if c.closed_at else None,
                "ends_at": c.ends_at.isoformat() if c.ends_at else None,
            }
            for c in comps
        ]
    }


@router.post("/competitions")
async def create_competition(
    body: CompetitionCreate,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    settings: SettingsDep,
    _: CsrfDep,
) -> dict[str, Any]:
    # Puzzle must exist, belong to teacher, and be published
    puzzle = (
        await session.execute(
            select(PuzzleSet)
            .where(PuzzleSet.id == body.puzzle_set_id)
            .where(PuzzleSet.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not puzzle:
        raise NotFoundError("Puzzle tidak ditemukan.")
    if puzzle.status != "published":
        raise ValidationError("Kompetisi hanya dapat dibuat menggunakan puzzle yang sudah dipublikasi.")

    # Groups must exist and belong to teacher
    group_stmt = (
        select(Group)
        .where(Group.teacher_id == teacher.id)
        .where(Group.id.in_(body.group_ids))
        .where(Group.status == "active")
    )
    valid_groups = (await session.execute(group_stmt)).scalars().all()
    if len(valid_groups) != len(set(body.group_ids)):
        raise ValidationError("Satu atau lebih grup tidak ditemukan atau tidak aktif.")

    # Generate unique join_code
    join_code = ""
    for _ in range(10):
        cand = generate_code(settings.competition_code_len)
        exists = (
            await session.execute(select(Competition).where(Competition.join_code == cand))
        ).scalar_one_or_none()
        if not exists:
            join_code = cand
            break
    if not join_code:
        raise ConflictError("Gagal menghasilkan kode kompetisi yang unik.")

    comp = Competition(
        teacher_id=teacher.id,
        name=body.name.strip(),
        join_code=join_code,
        status="draft",
        puzzle_set_id=puzzle.id,
        duration_minutes=body.duration_minutes,
        leaderboard_public=body.leaderboard_public,
        created_at=utcnow(),
    )
    session.add(comp)
    await session.commit()
    await session.refresh(comp)

    # Link groups to competition
    for g in valid_groups:
        cg = CompetitionGroup(
            competition_id=comp.id,
            group_id=g.id,
            status="joined",
            joined_at=utcnow(),
        )
        session.add(cg)
    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="competition.create",
        target_type="competition",
        target_id=str(comp.id),
        metadata={"join_code": comp.join_code, "name": comp.name},
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {
        "id": comp.id,
        "name": comp.name,
        "join_code": comp.join_code,
        "status": comp.status,
        "puzzle_set_id": comp.puzzle_set_id,
        "duration_minutes": comp.duration_minutes,
        "leaderboard_public": comp.leaderboard_public,
        "group_count": len(valid_groups),
    }


@router.get("/competitions/{comp_id}")
async def get_competition(
    comp_id: int,
    teacher: TeacherDep,
    session: SessionDep,
) -> dict[str, Any]:
    comp = (
        await session.execute(
            select(Competition)
            .where(Competition.id == comp_id)
            .where(Competition.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not comp:
        raise NotFoundError("Kompetisi tidak ditemukan.")

    groups_stmt = (
        select(Group, CompetitionGroup)
        .join(CompetitionGroup, CompetitionGroup.group_id == Group.id)
        .where(CompetitionGroup.competition_id == comp_id)
    )
    rows = (await session.execute(groups_stmt)).all()

    return {
        "id": comp.id,
        "name": comp.name,
        "join_code": comp.join_code,
        "status": comp.status,
        "puzzle_set_id": comp.puzzle_set_id,
        "duration_minutes": comp.duration_minutes,
        "leaderboard_public": comp.leaderboard_public,
        "created_at": comp.created_at.isoformat(),
        "opened_at": comp.opened_at.isoformat() if comp.opened_at else None,
        "started_at": comp.started_at.isoformat() if comp.started_at else None,
        "closed_at": comp.closed_at.isoformat() if comp.closed_at else None,
        "ends_at": comp.ends_at.isoformat() if comp.ends_at else None,
        "groups": [
            {
                "id": g.id,
                "group_code": g.group_code,
                "name": g.name,
                "status": cg.status,
                "joined_at": cg.joined_at.isoformat(),
            }
            for g, cg in rows
        ],
    }


@router.patch("/competitions/{comp_id}")
async def update_competition(
    comp_id: int,
    body: CompetitionUpdate,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    _: CsrfDep,
) -> dict[str, Any]:
    comp = (
        await session.execute(
            select(Competition)
            .where(Competition.id == comp_id)
            .where(Competition.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not comp:
        raise NotFoundError("Kompetisi tidak ditemukan.")

    if comp.status != "draft":
        raise ConflictError("Hanya kompetisi berstatus draft yang dapat diubah.")

    if body.name is not None:
        comp.name = body.name.strip()
    if body.duration_minutes is not None:
        comp.duration_minutes = body.duration_minutes
    if body.leaderboard_public is not None:
        comp.leaderboard_public = body.leaderboard_public
    await session.commit()

    return {"id": comp.id, "name": comp.name, "status": comp.status}


@router.post("/competitions/{comp_id}/open")
async def open_competition(
    comp_id: int,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    _: CsrfDep,
) -> dict[str, Any]:
    comp = (
        await session.execute(
            select(Competition)
            .where(Competition.id == comp_id)
            .where(Competition.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not comp:
        raise NotFoundError("Kompetisi tidak ditemukan.")

    if comp.status != "draft":
        raise ConflictError(f"Kompetisi berstatus '{comp.status}' tidak dapat dibuka.")

    comp.status = "open"
    comp.opened_at = utcnow()
    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="competition.open",
        target_type="competition",
        target_id=str(comp.id),
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {"id": comp.id, "status": comp.status, "opened_at": comp.opened_at.isoformat()}


@router.post("/competitions/{comp_id}/start")
async def start_competition(
    comp_id: int,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    _: CsrfDep,
) -> dict[str, Any]:
    comp = (
        await session.execute(
            select(Competition)
            .where(Competition.id == comp_id)
            .where(Competition.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not comp:
        raise NotFoundError("Kompetisi tidak ditemukan.")

    if comp.status != "open":
        raise ConflictError("Hanya kompetisi berstatus 'open' yang dapat dimulai.")

    # Get joined groups
    cgs = (
        await session.execute(
            select(CompetitionGroup)
            .where(CompetitionGroup.competition_id == comp_id)
            .where(CompetitionGroup.status == "joined")
        )
    ).scalars().all()

    if not cgs:
        raise ConflictError("Tidak ada grup yang bergabung. Minimal satu grup harus bergabung.")

    # Get puzzle to populate session entries
    puzzle = (
        await session.execute(select(PuzzleSet).where(PuzzleSet.id == comp.puzzle_set_id))
    ).scalar_one()
    parsed = parse_puzzle(puzzle.content_json)

    start_time = utcnow()
    deadline = start_time + timedelta(minutes=comp.duration_minutes)

    comp.status = "running"
    comp.started_at = start_time
    comp.ends_at = deadline

    # Create game session and session entries for each joined group
    for cg in cgs:
        cg.status = "in_progress"
        gs = GameSession(
            competition_id=comp.id,
            group_id=cg.group_id,
            status="active",
            started_at=start_time,
            deadline_at=deadline,
            last_event_at=start_time,
            last_seen_at=start_time,
            last_seen_throttled_at=start_time,
            created_at=start_time,
        )
        session.add(gs)
        await session.flush()

        for entry in parsed.entries:
            se = SessionEntry(
                session_id=gs.id,
                entry_id=entry.entry_id,
                status="unsolved",
                attempts=0,
                updated_at=start_time,
            )
            session.add(se)

    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="competition.start",
        target_type="competition",
        target_id=str(comp.id),
        metadata={"sessions_count": len(cgs)},
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {
        "id": comp.id,
        "status": comp.status,
        "started_at": comp.started_at.isoformat(),
        "ends_at": comp.ends_at.isoformat(),
        "active_sessions": len(cgs),
    }


@router.post("/competitions/{comp_id}/extend")
async def extend_competition(
    comp_id: int,
    body: ExtendRequest,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    _: CsrfDep,
) -> dict[str, Any]:
    comp = (
        await session.execute(
            select(Competition)
            .where(Competition.id == comp_id)
            .where(Competition.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not comp:
        raise NotFoundError("Kompetisi tidak ditemukan.")

    if comp.status != "running":
        raise ConflictError("Hanya kompetisi berstatus 'running' yang dapat diperpanjang.")

    if comp.ends_at and comp.ends_at < utcnow():
        raise ConflictError("Waktu kompetisi sudah berakhir.")

    added = timedelta(minutes=body.minutes)
    new_deadline = (comp.ends_at or utcnow()) + added
    comp.ends_at = new_deadline
    comp.duration_minutes += body.minutes

    # Update active sessions deadline
    await session.execute(
        update(GameSession)
        .where(GameSession.competition_id == comp_id)
        .where(GameSession.status == "active")
        .values(deadline_at=new_deadline)
    )
    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="competition.extend",
        target_type="competition",
        target_id=str(comp.id),
        metadata={"minutes": body.minutes, "new_deadline": new_deadline.isoformat()},
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {
        "id": comp.id,
        "ends_at": comp.ends_at.isoformat(),
        "duration_minutes": comp.duration_minutes,
    }


@router.post("/competitions/{comp_id}/close")
async def close_competition(
    comp_id: int,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    _: CsrfDep,
) -> dict[str, Any]:
    comp = (
        await session.execute(
            select(Competition)
            .where(Competition.id == comp_id)
            .where(Competition.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not comp:
        raise NotFoundError("Kompetisi tidak ditemukan.")

    if comp.status != "running":
        raise ConflictError("Hanya kompetisi berstatus 'running' yang dapat ditutup.")

    now = utcnow()
    comp.status = "closed"
    comp.closed_at = now

    # Expire any still active sessions
    await session.execute(
        update(GameSession)
        .where(GameSession.competition_id == comp_id)
        .where(GameSession.status == "active")
        .values(status="expired")
    )
    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="competition.close",
        target_type="competition",
        target_id=str(comp.id),
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {"id": comp.id, "status": comp.status, "closed_at": comp.closed_at.isoformat()}


@router.delete("/competitions/{comp_id}")
async def delete_competition(
    comp_id: int,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    _: CsrfDep,
) -> dict[str, Any]:
    comp = (
        await session.execute(
            select(Competition)
            .where(Competition.id == comp_id)
            .where(Competition.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not comp:
        raise NotFoundError("Kompetisi tidak ditemukan.")

    if comp.status != "draft":
        raise ConflictError("Hanya kompetisi berstatus draft yang dapat dihapus.")

    await session.delete(comp)
    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="competition.delete",
        target_type="competition",
        target_id=str(comp_id),
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {"ok": True}


# ==========================================
# MONITORING & RESULTS
# ==========================================


@router.get("/competitions/{comp_id}/sessions")
async def list_competition_sessions(
    comp_id: int,
    teacher: TeacherDep,
    session: SessionDep,
) -> dict[str, Any]:
    comp = (
        await session.execute(
            select(Competition)
            .where(Competition.id == comp_id)
            .where(Competition.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not comp:
        raise NotFoundError("Kompetisi tidak ditemukan.")

    stmt = (
        select(GameSession, Group)
        .join(Group, Group.id == GameSession.group_id)
        .where(GameSession.competition_id == comp_id)
    )
    rows = (await session.execute(stmt)).all()

    results = []
    for gs, g in rows:
        score = await current_score(session, gs.id)

        # Count solved and assisted entries
        solved_count = (
            await session.execute(
                select(func.count(SessionEntry.id))
                .where(SessionEntry.session_id == gs.id)
                .where(SessionEntry.status.in_(("solved", "assisted")))
            )
        ).scalar_one()

        hints_count = (
            await session.execute(
                select(func.count(SessionHint.id)).where(SessionHint.session_id == gs.id)
            )
        ).scalar_one()

        results.append(
            {
                "id": gs.id,
                "group_id": g.id,
                "group_code": g.group_code,
                "group_name": g.name,
                "status": gs.status,
                "score": score,
                "solved_count": solved_count,
                "hints_count": hints_count,
                "last_seen_at": gs.last_seen_at.isoformat() if gs.last_seen_at else None,
                "completed_at": gs.completed_at.isoformat() if gs.completed_at else None,
                "voided_at": gs.voided_at.isoformat() if gs.voided_at else None,
            }
        )

    # Sort: voided last, score DESC, completed_at ASC, group_name ASC
    def sort_key(s: dict[str, Any]) -> tuple:
        is_voided = s["status"] == "voided"
        score = s["score"]
        comp_at = s["completed_at"] or "9999-99-99"
        return (is_voided, -score, comp_at, s["group_name"])

    results.sort(key=sort_key)
    return {"sessions": results}


@router.post("/sessions/{session_id}/void")
async def void_session(
    session_id: int,
    body: VoidRequest,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
    _: CsrfDep,
) -> dict[str, Any]:
    stmt = (
        select(GameSession, Competition)
        .join(Competition, Competition.id == GameSession.competition_id)
        .where(GameSession.id == session_id)
        .where(Competition.teacher_id == teacher.id)
    )
    row = (await session.execute(stmt)).first()
    if not row:
        raise NotFoundError("Sesi game tidak ditemukan.")

    gs, comp = row
    now = utcnow()
    gs.status = "voided"
    gs.voided_at = now

    # Update CompetitionGroup to disqualified
    await session.execute(
        update(CompetitionGroup)
        .where(CompetitionGroup.competition_id == comp.id)
        .where(CompetitionGroup.group_id == gs.group_id)
        .values(
            status="disqualified",
            disqualified_at=now,
            reason=body.reason.strip(),
        )
    )
    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="session.void",
        target_type="game_session",
        target_id=str(gs.id),
        metadata={"group_id": gs.group_id, "reason": body.reason},
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    return {"id": gs.id, "status": "voided", "voided_at": gs.voided_at.isoformat()}


@router.get("/competitions/{comp_id}/export.csv")
async def export_competition_csv(
    comp_id: int,
    request: Request,
    teacher: TeacherDep,
    session: SessionDep,
) -> StreamingResponse:
    comp = (
        await session.execute(
            select(Competition)
            .where(Competition.id == comp_id)
            .where(Competition.teacher_id == teacher.id)
        )
    ).scalar_one_or_none()
    if not comp:
        raise NotFoundError("Kompetisi tidak ditemukan.")

    stmt = (
        select(GameSession, Group)
        .join(Group, Group.id == GameSession.group_id)
        .where(GameSession.competition_id == comp_id)
    )
    rows = (await session.execute(stmt)).all()

    def sanitize(val: Any) -> str:
        s = str(val or "")
        if s and s[0] in ("=", "+", "-", "@"):
            return "'" + s
        return s

    entries_data = []
    for gs, g in rows:
        sc = await current_score(session, gs.id)
        dur = ""
        if gs.completed_at and gs.started_at:
            dur = str(int((gs.completed_at - gs.started_at).total_seconds()))
        entries_data.append(
            {
                "group_code": g.group_code,
                "group_name": g.name,
                "score": sc,
                "status": gs.status,
                "started_at": gs.started_at.isoformat() if gs.started_at else "",
                "completed_at": gs.completed_at.isoformat() if gs.completed_at else "",
                "duration_seconds": dur,
            }
        )

    # Sort ranking
    entries_data.sort(
        key=lambda x: (
            x["status"] == "voided",
            -x["score"],
            x["completed_at"] or "9999-99-99",
            x["group_name"],
        )
    )

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(
        [
            "Rank",
            "Group Code",
            "Group Name",
            "Score",
            "Status",
            "Started At",
            "Completed At",
            "Duration Seconds",
        ]
    )
    rank = 1
    for item in entries_data:
        r_str = str(rank) if item["status"] != "voided" else "VOID"
        writer.writerow(
            [
                r_str,
                sanitize(item["group_code"]),
                sanitize(item["group_name"]),
                sanitize(item["score"]),
                sanitize(item["status"]),
                sanitize(item["started_at"]),
                sanitize(item["completed_at"]),
                sanitize(item["duration_seconds"]),
            ]
        )
        if item["status"] != "voided":
            rank += 1

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="competition.export",
        target_type="competition",
        target_id=str(comp.id),
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    out.seek(0)
    filename = f"competition-{comp.join_code}-results.csv"
    return StreamingResponse(
        iter([out.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/audit")
async def list_audit_logs(
    teacher: TeacherDep,
    session: SessionDep,
) -> dict[str, Any]:
    stmt = (
        select(AuditLog)
        .where(AuditLog.teacher_id == teacher.id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    )
    logs = (await session.execute(stmt)).scalars().all()
    return {
        "logs": [
            {
                "id": log.id,
                "action": log.action,
                "actor_type": log.actor_type,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "metadata": log.metadata_json,
                "ip": log.ip,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ]
    }
