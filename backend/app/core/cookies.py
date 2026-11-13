from __future__ import annotations

from fastapi import Response

from app.core.config import get_settings


def _set_auth(
    response: Response,
    name: str,
    value: str,
    max_age_seconds: int,
) -> None:
    s = get_settings()
    response.set_cookie(
        key=name,
        value=value,
        max_age=max_age_seconds,
        httponly=True,
        secure=s.cookie_secure,
        samesite="lax",
        path="/",
    )


def _set_readable(response: Response, name: str, value: str, max_age_seconds: int) -> None:
    s = get_settings()
    response.set_cookie(
        key=name,
        value=value,
        max_age=max_age_seconds,
        httponly=False,
        secure=s.cookie_secure,
        samesite="lax",
        path="/",
    )


def set_teacher_cookies(response: Response, token: str, csrf: str, ttl_seconds: int) -> None:
    s = get_settings()
    _set_auth(response, s.teacher_cookie, token, ttl_seconds)
    _set_readable(response, s.teacher_csrf_cookie, csrf, ttl_seconds)


def clear_teacher_cookies(response: Response) -> None:
    s = get_settings()
    for name in (s.teacher_cookie, s.teacher_csrf_cookie):
        response.delete_cookie(name, path="/")


def set_group_cookies(response: Response, token: str, csrf: str, ttl_seconds: int) -> None:
    s = get_settings()
    _set_auth(response, s.group_cookie, token, ttl_seconds)
    _set_readable(response, s.group_csrf_cookie, csrf, ttl_seconds)


def clear_group_cookies(response: Response) -> None:
    s = get_settings()
    for name in (s.group_cookie, s.group_csrf_cookie):
        response.delete_cookie(name, path="/")


def set_playtest_cookies(response: Response, token: str, csrf: str, ttl_seconds: int) -> None:
    s = get_settings()
    _set_auth(response, s.playtest_cookie, token, ttl_seconds)
    _set_readable(response, s.playtest_csrf_cookie, csrf, ttl_seconds)


def clear_playtest_cookies(response: Response) -> None:
    s = get_settings()
    for name in (s.playtest_cookie, s.playtest_csrf_cookie):
        response.delete_cookie(name, path="/")
