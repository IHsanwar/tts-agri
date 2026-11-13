from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_CORE_DIR = Path(__file__).resolve().parent
_APP_DIR = _CORE_DIR.parent
_BACKEND_DIR = _APP_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent

_ENV_FILES = [
    _ROOT_DIR / ".env",
    _BACKEND_DIR / ".env",
    ".env",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_prefix="TTS_",
        extra="ignore",
    )

    app_origin: str = "http://localhost:5173"
    app_url: str = Field(
        default="",
        validation_alias=AliasChoices("TTS_APP_URL", "APP_URL", "app_url"),
    )
    cookie_secure: bool = False
    app_debug: bool = Field(
        default=False,
        validation_alias=AliasChoices("TTS_APP_DEBUG", "APP_DEBUG", "app_debug"),
    )
    invite_code: str = "change-me-invite-code"
    session_ttl_hours_teacher: int = 168
    session_ttl_hours_group: int = 12
    session_ttl_hours_playtest: int = 4
    group_pin_digits: int = 6
    competition_code_len: int = 6
    group_code_len: int = 4
    max_request_bytes: int = 64 * 1024
    max_puzzle_bytes: int = 512 * 1024
    max_events_per_batch: int = 20
    rate_join_per_minute_ip: int = 8
    rate_join_per_minute_group: int = 12
    rate_register_per_minute_ip: int = 5
    rate_events_per_minute_session: int = 60
    rate_wrong_attempts_per_minute_session: int = 10
    cors_origins: str = ""
    teacher_cookie: str = "tts_teacher"
    teacher_csrf_cookie: str = "tts_teacher_csrf"
    group_cookie: str = "tts_group"
    group_csrf_cookie: str = "tts_group_csrf"
    playtest_cookie: str = "tts_playtest"
    playtest_csrf_cookie: str = "tts_playtest_csrf"

    # MySQL configuration (Pure MySQL — no SQLite fallback)
    db_user: str = Field(
        default="root",
        validation_alias=AliasChoices("TTS_DB_USER", "DB_USER", "db_user"),
    )
    db_name: str = Field(
        default="ttsdulu",
        validation_alias=AliasChoices("TTS_DB_NAME", "DB_NAME", "db_name"),
    )
    db_password: str = Field(
        default="",
        validation_alias=AliasChoices("TTS_DB_PASSWORD", "DB_PASSWORD", "db_password"),
    )
    db_host: str = Field(
        default="localhost",
        validation_alias=AliasChoices("TTS_DB_HOST", "DB_HOST", "db_host"),
    )
    db_port: int = Field(
        default=3306,
        validation_alias=AliasChoices("TTS_DB_PORT", "DB_PORT", "db_port"),
    )

    @field_validator("app_origin", "app_url", mode="after")
    @classmethod
    def _strip_trailing_slash(cls, value: str) -> str:
        """Normalize configured URLs to a bare scheme://host[:port].

        Origin checks and CORS compare these values against browser-sent
        origins, which never carry a trailing slash. Leaving one in place made
        ``origin.startswith(app_origin)`` reject every real browser origin, so
        normalize at the edge instead of relying on each call site.
        """
        return value.strip().rstrip("/")

    @property
    def database_url(self) -> str:
        """Async MySQL database URL for FastAPI application (aiomysql)."""
        pwd = f":{self.db_password}" if self.db_password else ""
        return (
            f"mysql+aiomysql://{self.db_user}{pwd}@"
            f"{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )

    @property
    def sync_database_url(self) -> str:
        """Sync MySQL database URL for Alembic migrations (pymysql)."""
        pwd = f":{self.db_password}" if self.db_password else ""
        return (
            f"mysql+pymysql://{self.db_user}{pwd}@"
            f"{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )

    @property
    def public_app_url(self) -> str:
        """Returns the base frontend application URL (from TTS_APP_URL or TTS_APP_ORIGIN)."""
        url = self.app_url.strip() if self.app_url else self.app_origin.strip()
        return url.rstrip("/")

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.app_url:
            cleaned = self.app_url.strip().rstrip("/")
            if cleaned and cleaned not in origins and cleaned != self.app_origin.rstrip("/"):
                origins.append(cleaned)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
