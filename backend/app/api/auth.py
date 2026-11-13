from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.api.deps import (
    CsrfDep,
    SessionDep,
    SettingsDep,
    TeacherDep,
    client_ip,
    require_origin,
    revoke_teacher_session,
    start_teacher_session,
)
from app.core.errors import AuthError, ConflictError, RateLimitError, ValidationError
from app.core.rate_limit import _register_ip
from app.core.security import hash_password, verify_password
from app.core.time import utcnow
from app.models import Teacher, TeacherSession
from app.schemas.auth import LoginRequest, RegisterRequest, TeacherPublic
from app.services.audit import record_audit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(
    data: RegisterRequest,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
    _: None = Depends(require_origin),
) -> dict:
    ip = client_ip(request)
    if not _register_ip.allow(ip):
        raise RateLimitError("Terlalu banyak permintaan registrasi. Silakan coba lagi nanti.")

    if data.invite_code.strip() != settings.invite_code.strip():
        raise ValidationError("Kode undangan guru tidak valid.")

    email_norm = str(data.email).strip().lower()
    existing = (
        await session.execute(select(Teacher).where(Teacher.email == email_norm))
    ).scalar_one_or_none()
    if existing:
        raise ConflictError("Email sudah terdaftar.")

    pwd_hash = await run_in_threadpool(hash_password, data.password)
    teacher = Teacher(
        email=email_norm,
        password_hash=pwd_hash,
        name=data.name.strip(),
        is_active=True,
        created_at=utcnow(),
        last_login_at=utcnow(),
    )
    session.add(teacher)
    await session.commit()
    await session.refresh(teacher)

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="auth.register",
        target_type="teacher",
        target_id=str(teacher.id),
        ip=ip,
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    await start_teacher_session(response, session, teacher, settings, request)

    return {
        "teacher": TeacherPublic(
            id=teacher.id,
            email=teacher.email,
            name=teacher.name,
        )
    }


@router.post("/login")
async def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
    _: None = Depends(require_origin),
) -> dict:
    ip = client_ip(request)
    email_norm = str(data.email).strip().lower()
    teacher = (
        await session.execute(select(Teacher).where(Teacher.email == email_norm))
    ).scalar_one_or_none()

    if not teacher or not teacher.is_active:
        raise AuthError("Email atau kata sandi salah.")

    valid = await run_in_threadpool(verify_password, data.password, teacher.password_hash)
    if not valid:
        raise AuthError("Email atau kata sandi salah.")

    teacher.last_login_at = utcnow()
    await session.commit()

    await record_audit(
        session,
        teacher_id=teacher.id,
        actor_type="teacher",
        actor_id=str(teacher.id),
        action="auth.login",
        target_type="teacher",
        target_id=str(teacher.id),
        ip=ip,
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()

    await start_teacher_session(response, session, teacher, settings, request)

    return {
        "teacher": TeacherPublic(
            id=teacher.id,
            email=teacher.email,
            name=teacher.name,
        )
    }


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
    _: CsrfDep,
) -> dict:
    token = request.cookies.get(settings.teacher_cookie)
    if token:
        from app.core.security import hash_token

        token_h = hash_token(token)
        ts = (
            await session.execute(
                select(TeacherSession)
                .where(TeacherSession.token_hash == token_h)
                .where(TeacherSession.revoked_at.is_(None))
            )
        ).scalar_one_or_none()
        if ts:
            await record_audit(
                session,
                teacher_id=ts.teacher_id,
                actor_type="teacher",
                actor_id=str(ts.teacher_id),
                action="auth.logout",
                target_type="teacher_session",
                target_id=str(ts.id),
                ip=client_ip(request),
                user_agent=request.headers.get("user-agent"),
            )
    await revoke_teacher_session(session, token, response, settings)
    return {"ok": True}


@router.get("/me")
async def me(
    teacher: TeacherDep,
    request: Request,
    settings: SettingsDep,
) -> dict:
    csrf_token = request.cookies.get(settings.teacher_csrf_cookie)
    return {
        "teacher": TeacherPublic(
            id=teacher.id,
            email=teacher.email,
            name=teacher.name,
        ),
        "csrf_token": csrf_token,
    }

