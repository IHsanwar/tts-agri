from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="TTS_", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./data/tts.sqlite"
    app_origin: str = "http://localhost:5173"
    cookie_secure: bool = False
    invite_code: str = "change-me-invite-code"
    session_ttl_hours_teacher: int = 168
    session_ttl_hours_group: int = 12
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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
