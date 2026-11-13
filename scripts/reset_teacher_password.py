#!/usr/bin/env python3
"""CLI utility to reset a teacher's password directly on the server."""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select

from app.core.security import hash_password
from app.db.engine import SessionLocal
from app.models import Teacher


async def reset_password(email: str, new_password: str) -> None:
    async with SessionLocal() as session:
        email_norm = email.strip().lower()
        teacher = (
            await session.execute(select(Teacher).where(Teacher.email == email_norm))
        ).scalar_one_or_none()

        if not teacher:
            print(f"Error: Akun guru dengan email '{email_norm}' tidak ditemukan.", file=sys.stderr)
            sys.exit(1)

        teacher.password_hash = hash_password(new_password)
        await session.commit()
        print(f"Berhasil! Password untuk '{teacher.email}' ({teacher.name}) telah diperbarui.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset password akun guru.")
    parser.add_argument("email", help="Alamat email guru")
    parser.add_argument("password", help="Password baru (minimal 10 karakter)")
    args = parser.parse_args()

    if len(args.password) < 10:
        print("Error: Password baru minimal harus 10 karakter.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(reset_password(args.email, args.password))


if __name__ == "__main__":
    main()

