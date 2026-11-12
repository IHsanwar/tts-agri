from __future__ import annotations

import uuid
from typing import Any

from fastapi import Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.auth import router as auth_router
from app.api.deps import SessionDep
from app.api.play import router as play_router
from app.api.public import router as public_router
from app.api.teacher import router as teacher_router
from app.core.config import get_settings
from app.core.errors import AppError, envelope
from app.core.time import utcnow


class RequestIdAndLimitMiddleware:
    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        req_id = headers.get(b"x-request-id", b"").decode("latin1") or str(uuid.uuid4())

        async def send_wrapper(message: Any) -> None:
            if message["type"] == "http.response.start":
                msg_headers = list(message.get("headers", []))
                msg_headers.append((b"x-request-id", req_id.encode("latin1")))
                message["headers"] = msg_headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="TTS Arena API",
        version="0.1.0",
        docs_url="/docs" if not settings.cookie_secure else None,
        redoc_url=None,
    )

    # app.add_middleware(RequestIdAndLimitMiddleware)

    # CORS
    origins = [settings.app_origin] + settings.cors_origin_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["x-request-id"],
    )

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=envelope(exc),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Format data tidak valid.",
                    "details": exc.errors(),
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "server_error",
                    "message": "Terjadi kesalahan internal pada server.",
                    "details": {},
                }
            },
        )

    # Base API endpoints
    @app.get("/api/health")
    async def health(session: SessionDep) -> dict:
        db_status = "ok"
        try:
            await session.execute(text("SELECT 1"))
        except Exception:
            db_status = "error"
        return {"status": "ok", "db": db_status}

    @app.get("/api/time")
    async def get_time() -> dict:
        now = utcnow()
        return {
            "now_iso": now.isoformat(),
            "now_ms": int(now.timestamp() * 1000),
        }

    # Routers
    app.include_router(auth_router, prefix="/api")
    app.include_router(teacher_router, prefix="/api")
    app.include_router(play_router, prefix="/api")
    app.include_router(public_router, prefix="/api")

    return app


app = create_app()
