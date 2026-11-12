from __future__ import annotations

from typing import Any


class AppError(Exception):
    code: str = "error"
    status_code: int = 400

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationError(AppError):
    code = "validation_error"
    status_code = 400


class AuthError(AppError):
    code = "unauthorized"
    status_code = 401


class ForbiddenError(AppError):
    code = "forbidden"
    status_code = 403


class NotFoundError(AppError):
    code = "not_found"
    status_code = 404


class ConflictError(AppError):
    code = "conflict"
    status_code = 409


class RateLimitError(AppError):
    code = "rate_limited"
    status_code = 429


class CsrfError(AppError):
    code = "csrf_error"
    status_code = 403


def envelope(error: AppError) -> dict[str, Any]:
    return {"error": {"code": error.code, "message": error.message, "details": error.details}}
