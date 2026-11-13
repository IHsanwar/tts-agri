from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import timedelta
from typing import Annotated, Any
from urllib.parse import urlsplit

from fastapi import Cookie, Depends, Header, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.cookies import (
    clear_teacher_cookies,
    set_group_cookies,
    set_playtest_cookies,
    set_teacher_cookies,
)
from app.core.errors import AuthError, CsrfError, ForbiddenError, NotFoundError, RateLimitError
from app.core.security import constant_time_eq, generate_csrf_token, generate_token, hash_token
from app.core.time import utcnow
from app.db.engine import SessionLocal
from app.models import Teacher, TeacherSession


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def get_current_teacher(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
) -> Teacher:
    token = request.cookies.get(settings.teacher_cookie)
    if not token:
        raise AuthError("Sesi guru tidak ditemukan.")
    token_h = hash_token(token)
    ts = (
        await session.execute(
            select(TeacherSession)
            .where(TeacherSession.token_hash == token_h)
            .where(TeacherSession.revoked_at.is_(None))
        )
    ).scalar_one_or_none()
    if not ts or ts.expires_at < utcnow():
        raise AuthError("Sesi guru tidak valid atau telah berakhir.")
    teacher = (
        await session.execute(select(Teacher).where(Teacher.id == ts.teacher_id))
    ).scalar_one_or_none()
    if not teacher or not teacher.is_active:
        raise AuthError("Akun guru tidak aktif.")
    ts.last_seen_at = utcnow()
    await session.commit()
    return teacher


TeacherDep = Annotated[Teacher, Depends(get_current_teacher)]


def require_write_method(request: Request, settings: SettingsDep) -> None:
    """Enforce CSRF via double-submit cookie + header for non-GET methods."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    # Origin check
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if origin and not _is_origin_allowed(origin, settings):
        raise ForbiddenError("Akses dari origin tidak diizinkan.")
    cookie_name = settings.teacher_csrf_cookie
    csrf_cookie = request.cookies.get(cookie_name)
    csrf_header = request.headers.get("x-csrf-token") or request.headers.get("x-tts-csrf")
    if not csrf_cookie or not csrf_header or not constant_time_eq(csrf_cookie, csrf_header):
        raise CsrfError("Token CSRF tidak valid.")


CsrfDep = Annotated[None, Depends(require_write_method)]


def _normalize_origin(value: str) -> str:
    """Reduce an Origin/Referer value to a canonical scheme://host[:port].

    Browsers send a bare origin (``https://host``), but a Referer carries a full
    path and the configured settings may carry a trailing slash. Comparing the
    normalized forms avoids both false rejections and prefix-based bypasses such
    as ``https://app.example.com.evil.tld``.
    """
    raw = (value or "").strip().rstrip("/")
    if not raw:
        return ""
    try:
        parts = urlsplit(raw if "://" in raw else f"//{raw}")
    except ValueError:
        return raw.lower()
    scheme = (parts.scheme or "").lower()
    netloc = parts.netloc.lower()
    if not netloc:
        return raw.lower()
    return f"{scheme}://{netloc}" if scheme else netloc


def _allowed_origins(settings: Settings) -> set[str]:
    allowed: set[str] = set()
    for base in [settings.app_origin, settings.public_app_url] + settings.cors_origin_list:
        normalized = _normalize_origin(base)
        if normalized:
            allowed.add(normalized)
            if "localhost" in normalized:
                allowed.add(normalized.replace("localhost", "127.0.0.1"))
            elif "127.0.0.1" in normalized:
                allowed.add(normalized.replace("127.0.0.1", "localhost"))
    # Always allow local dev origins
    allowed.update(
        [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ]
    )
    return allowed


def _is_origin_allowed(origin: str, settings: Settings) -> bool:
    if not origin:
        return True
    # Origin checks are intentionally open to support frontends on arbitrary
    # domains. Mutating requests still require the double-submit CSRF token.
    return bool(_normalize_origin(origin))


def require_origin(request: Request, settings: SettingsDep) -> None:
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if origin and not _is_origin_allowed(origin, settings):
        raise ForbiddenError("Akses dari origin tidak diizinkan.")


async def start_teacher_session(
    response: Response,
    session: AsyncSession,
    teacher: Teacher,
    settings: Settings,
    request: Request,
) -> tuple[str, str]:
    token = generate_token()
    csrf = generate_csrf_token()
    ttl = timedelta(hours=settings.session_ttl_hours_teacher)
    ts = TeacherSession(
        teacher_id=teacher.id,
        token_hash=hash_token(token),
        csrf_token_hash=hash_token(csrf),
        expires_at=utcnow() + ttl,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent", "")[:255],
    )
    session.add(ts)
    await session.commit()
    set_teacher_cookies(response, token, csrf, int(ttl.total_seconds()))
    return token, csrf


async def revoke_teacher_session(
    session: AsyncSession,
    token: str | None,
    response: Response,
    settings: Settings,
) -> None:
    if token:
        token_h = hash_token(token)
        ts = (
            await session.execute(
                select(TeacherSession)
                .where(TeacherSession.token_hash == token_h)
                .where(TeacherSession.revoked_at.is_(None))
            )
        ).scalar_one_or_none()
        if ts:
            ts.revoked_at = utcnow()
            await session.commit()
    clear_teacher_cookies(response)


async def start_group_session(
    response: Response,
    session: AsyncSession,
    cg: Any,
    settings: Settings,
) -> tuple[str, str]:
    raw_token = generate_token()
    csrf_token = generate_csrf_token()
    cg.token_hash = hash_token(raw_token)
    cg.csrf_token_hash = hash_token(csrf_token)
    await session.commit()

    token_cookie_val = f"{cg.id}:{raw_token}"
    ttl_seconds = int(timedelta(hours=settings.session_ttl_hours_group).total_seconds())
    set_group_cookies(response, token_cookie_val, csrf_token, ttl_seconds)
    return token_cookie_val, csrf_token


async def get_current_group_session(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
) -> tuple[Any, Any]:
    from app.models import CompetitionGroup, GameSession

    token = request.cookies.get(settings.group_cookie)
    if not token or ":" not in token:
        raise AuthError("Sesi grup tidak ditemukan.")
    try:
        cg_id_str, raw_token = token.split(":", 1)
        cg_id = int(cg_id_str)
    except Exception:
        raise AuthError("Format token sesi grup tidak valid.")

    cg = (
        await session.execute(
            select(CompetitionGroup).where(CompetitionGroup.id == cg_id)
        )
    ).scalar_one_or_none()
    if not cg or not cg.token_hash or cg.token_hash != hash_token(raw_token):
        raise AuthError("Sesi grup tidak valid atau telah diambil alih oleh perangkat lain.")

    gs = (
        await session.execute(
            select(GameSession)
            .where(GameSession.competition_id == cg.competition_id)
            .where(GameSession.group_id == cg.group_id)
        )
    ).scalar_one_or_none()

    return cg, gs


GroupSessionDep = Annotated[tuple[Any, Any], Depends(get_current_group_session)]


def require_group_csrf(
    request: Request,
    settings: SettingsDep,
) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if origin and not _is_origin_allowed(origin, settings):
        raise ForbiddenError("Akses dari origin tidak diizinkan.")
    cookie_name = settings.group_csrf_cookie
    csrf_cookie = request.cookies.get(cookie_name)
    csrf_header = request.headers.get("x-csrf-token") or request.headers.get("x-tts-csrf")
    if not csrf_cookie or not csrf_header or not constant_time_eq(csrf_cookie, csrf_header):
        raise CsrfError("Token CSRF tidak valid.")


GroupCsrfDep = Annotated[None, Depends(require_group_csrf)]


async def start_playtest_session(
    response: Response,
    session: AsyncSession,
    gs: Any,
    settings: Settings,
) -> tuple[str, str]:
    raw_token = generate_token()
    csrf_token = generate_csrf_token()
    gs.playtest_token_hash = hash_token(raw_token)
    gs.playtest_csrf_token_hash = hash_token(csrf_token)
    await session.commit()

    token_cookie_val = f"{gs.id}:{raw_token}"
    ttl_seconds = int(timedelta(hours=settings.session_ttl_hours_playtest).total_seconds())
    set_playtest_cookies(response, token_cookie_val, csrf_token, ttl_seconds)
    return token_cookie_val, csrf_token


async def get_current_playtest_session(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
) -> Any:
    from app.models import GameSession

    token = request.cookies.get(settings.playtest_cookie)
    if not token or ":" not in token:
        raise AuthError("Sesi playtest tidak ditemukan.")
    try:
        gs_id_str, raw_token = token.split(":", 1)
        gs_id = int(gs_id_str)
    except Exception:
        raise AuthError("Format token sesi playtest tidak valid.")

    gs = (
        await session.execute(
            select(GameSession).where(GameSession.id == gs_id)
        )
    ).scalar_one_or_none()
    if not gs or not gs.playtest_token_hash or gs.playtest_token_hash != hash_token(raw_token):
        raise AuthError("Sesi playtest tidak valid.")

    return gs


PlaytestSessionDep = Annotated[Any, Depends(get_current_playtest_session)]


def require_playtest_csrf(
    request: Request,
    settings: SettingsDep,
) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if origin and not _is_origin_allowed(origin, settings):
        raise ForbiddenError("Akses dari origin tidak diizinkan.")
    csrf_cookie = request.cookies.get(settings.playtest_csrf_cookie)
    csrf_header = request.headers.get("x-csrf-token") or request.headers.get("x-tts-csrf")
    if not csrf_cookie or not csrf_header or not constant_time_eq(csrf_cookie, csrf_header):
        raise CsrfError("Token CSRF tidak valid.")


PlaytestCsrfDep = Annotated[None, Depends(require_playtest_csrf)]
