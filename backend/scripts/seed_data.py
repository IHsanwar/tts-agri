"""
Seed script — populate the TTS Arena MySQL database with demo data.

Usage:
    cd backend
    python -m scripts.seed_data

The script is idempotent: it checks for existing teacher email before inserting.
"""
from __future__ import annotations

import asyncio
import sys
from datetime import timedelta
from pathlib import Path

# Ensure backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.core.hashing import compute_sha256
from app.core.security import (
    generate_code,
    generate_csrf_token,
    generate_pin,
    generate_token,
    hash_password,
    hash_token,
)
from app.core.time import utcnow
from app.db.engine import SessionLocal
from app.models.auth import Teacher, TeacherSession
from app.models.content import Competition, CompetitionGroup, Group, PuzzleSet
from app.models.game import GameSession

# ---------------------------------------------------------------------------
# Sample crossword puzzle (7×7, school theme, 5 words)
# ---------------------------------------------------------------------------
#
#   col: 0 1 2 3 4 5 6
# r0:   # # C # # # #
# r1:   # # H # C # #
# r2:   T E A C H E R       TEACHER across
# r3:   # # L # A # U
# r4:   I N K # I # L       INK across
# r5:   # # # # R # E
# r6:   # # # # # # R
#
# Down: CHALK (0,2)→(4,2), CHAIR (1,4)→(5,4), RULER (2,6)→(6,6)
#
PUZZLE_CONTENT = {
    "schema_version": 1,
    "version": "school-v1",
    "title": "School Life",
    "language": "en",
    "grid": [
        "##C####",
        "##H#C##",
        "TEACHER",
        "##L#A#U",
        "INK#I#L",
        "####R#E",
        "######R",
    ],
    "entries": [
        {
            "id": "teacher-across",
            "row": 2, "col": 0,
            "direction": "across",
            "answer": "TEACHER",
            "clue_en": "A person who instructs students in class.",
            "clue_id": "Seseorang yang mengajar siswa di kelas.",
        },
        {
            "id": "ink-across",
            "row": 4, "col": 0,
            "direction": "across",
            "answer": "INK",
            "clue_en": "The colored liquid inside a pen.",
            "clue_id": "Cairan berwarna di dalam pena.",
        },
        {
            "id": "chalk-down",
            "row": 0, "col": 2,
            "direction": "down",
            "answer": "CHALK",
            "clue_en": "A white stick used to write on a blackboard.",
            "clue_id": "Batang putih untuk menulis di papan tulis.",
        },
        {
            "id": "chair-down",
            "row": 1, "col": 4,
            "direction": "down",
            "answer": "CHAIR",
            "clue_en": "A piece of furniture you sit on in class.",
            "clue_id": "Perabotan yang kamu duduki di kelas.",
        },
        {
            "id": "ruler-down",
            "row": 2, "col": 6,
            "direction": "down",
            "answer": "RULER",
            "clue_en": "A straight tool used for measuring and drawing lines.",
            "clue_id": "Alat lurus untuk mengukur dan menggambar garis.",
        },
    ],
}


async def main() -> None:
    now = utcnow()
    async with SessionLocal() as session:
        # ------------------------------------------------------------------
        # 1. Idempotency check
        # ------------------------------------------------------------------
        existing = await session.execute(
            select(Teacher).where(Teacher.email == "demo@tts-arena.local")
        )
        if existing.scalars().first():
            print("✔ Seed data sudah ada. Skip.")
            return

        # ------------------------------------------------------------------
        # 2. Teacher
        # ------------------------------------------------------------------
        teacher = Teacher(
            email="demo@tts-arena.local",
            password_hash=hash_password("DemoPass123!"),
            name="Pak Demo",
            is_active=True,
            created_at=now,
        )
        session.add(teacher)
        await session.flush()
        print(f"  Teacher  : id={teacher.id}, email={teacher.email}")

        # ------------------------------------------------------------------
        # 3. Teacher session (valid for 7 days)
        # ------------------------------------------------------------------
        raw_token = generate_token()
        raw_csrf = generate_csrf_token()
        teacher_session = TeacherSession(
            teacher_id=teacher.id,
            token_hash=hash_token(raw_token),
            csrf_token_hash=hash_token(raw_csrf),
            expires_at=now + timedelta(days=7),
            last_seen_at=now,
            ip="127.0.0.1",
            user_agent="seed-script",
            created_at=now,
        )
        session.add(teacher_session)
        await session.flush()
        print(f"  Session  : id={teacher_session.id}")

        # ------------------------------------------------------------------
        # 4. Puzzle set (published)
        # ------------------------------------------------------------------
        sha = compute_sha256(PUZZLE_CONTENT)
        puzzle = PuzzleSet(
            teacher_id=teacher.id,
            version="school-v1",
            schema_version=1,
            title="School Life",
            content_json=PUZZLE_CONTENT,
            sha256=sha,
            status="published",
            created_at=now,
            published_at=now,
        )
        session.add(puzzle)
        await session.flush()
        print(f"  Puzzle   : id={puzzle.id}, title={puzzle.title}")

        # ------------------------------------------------------------------
        # 5. Groups (3 demo groups)
        # ------------------------------------------------------------------
        group_info = [
            ("Kelompok Alpha", "ALPH"),
            ("Kelompok Beta", "BETA"),
            ("Kelompok Gamma", "GAMA"),
        ]
        groups: list[Group] = []
        pins: list[str] = []
        for name, code in group_info:
            pin = generate_pin(6)
            pins.append(pin)
            grp = Group(
                teacher_id=teacher.id,
                group_code=code,
                name=name,
                pin_hash=hash_password(pin),
                status="active",
                created_at=now,
                updated_at=now,
            )
            session.add(grp)
            groups.append(grp)

        await session.flush()
        for g, pin in zip(groups, pins):
            print(f"  Group    : id={g.id}, code={g.group_code}, name={g.name}, PIN={pin}")

        # ------------------------------------------------------------------
        # 6. Competition (status=open, ready for groups to join)
        # ------------------------------------------------------------------
        join_code = generate_code(6)
        competition = Competition(
            teacher_id=teacher.id,
            name="Demo Competition — School Life",
            join_code=join_code,
            status="open",
            puzzle_set_id=puzzle.id,
            rules_json={},
            leaderboard_public=True,
            duration_minutes=15,
            created_at=now,
            opened_at=now,
        )
        session.add(competition)
        await session.flush()
        print(f"  Compete  : id={competition.id}, join_code={join_code}, status=open")

        # ------------------------------------------------------------------
        # 7. CompetitionGroups — link all groups to competition
        # ------------------------------------------------------------------
        comp_groups: list[CompetitionGroup] = []
        for g in groups:
            cg_token = generate_token()
            cg_csrf = generate_csrf_token()
            cg = CompetitionGroup(
                competition_id=competition.id,
                group_id=g.id,
                status="joined",
                token_hash=hash_token(cg_token),
                csrf_token_hash=hash_token(cg_csrf),
                joined_at=now,
            )
            session.add(cg)
            comp_groups.append(cg)

        await session.flush()
        for cg in comp_groups:
            print(f"  CompGrp  : id={cg.id}, comp={cg.competition_id}, group={cg.group_id}")

        # ------------------------------------------------------------------
        # 8. GameSession for the first group (active game)
        # ------------------------------------------------------------------
        game_session = GameSession(
            competition_id=competition.id,
            group_id=groups[0].id,
            status="active",
            started_at=now,
            deadline_at=now + timedelta(minutes=15),
            last_event_at=now,
            last_seen_at=now,
            last_seen_throttled_at=now,
            created_at=now,
        )
        session.add(game_session)
        await session.flush()
        print(f"  Game     : id={game_session.id}, group={groups[0].name}, status=active")

        # ------------------------------------------------------------------
        # Commit
        # ------------------------------------------------------------------
        await session.commit()

        print()
        print("=" * 60)
        print("  SEED DATA BERHASIL DITAMBAHKAN!")
        print("=" * 60)
        print()
        print("  Kredensial:")
        print(f"    Teacher  : demo@tts-arena.local / DemoPass123!")
        print(f"    Join code: {join_code}")
        for g, pin in zip(groups, pins):
            print(f"    {g.name:<20s}: code={g.group_code}, PIN={pin}")
        print()


if __name__ == "__main__":
    async def _run() -> None:
        from app.db.engine import engine
        try:
            await main()
        finally:
            await engine.dispose()

    asyncio.run(_run())
