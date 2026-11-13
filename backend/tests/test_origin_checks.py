from __future__ import annotations

from typing import Any

import pytest

from app.api.deps import _is_origin_allowed, _normalize_origin
from app.core.config import Settings


def _settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "app_origin": "https://tts.ihsanwardhana.web.id",
        "app_url": "https://tts.ihsanwardhana.web.id",
        "cors_origins": "",
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://tts.ihsanwardhana.web.id", "https://tts.ihsanwardhana.web.id"),
        ("https://tts.ihsanwardhana.web.id/", "https://tts.ihsanwardhana.web.id"),
        ("https://TTS.Ihsanwardhana.Web.id", "https://tts.ihsanwardhana.web.id"),
        (
            "https://tts.ihsanwardhana.web.id/teacher/login?x=1",
            "https://tts.ihsanwardhana.web.id",
        ),
        ("http://localhost:5173", "http://localhost:5173"),
        ("", ""),
    ],
)
def test_normalize_origin(raw: str, expected: str) -> None:
    assert _normalize_origin(raw) == expected


def test_deployed_frontend_origin_is_allowed() -> None:
    """The exact browser Origin sent by the Vercel deployment must pass."""
    assert _is_origin_allowed("https://tts.ihsanwardhana.web.id", _settings())


def test_trailing_slash_in_configured_origin_still_matches() -> None:
    """A trailing slash in TTS_APP_ORIGIN used to reject every real browser origin."""
    settings = _settings(app_origin="https://tts.ihsanwardhana.web.id/")
    assert _is_origin_allowed("https://tts.ihsanwardhana.web.id", settings)


def test_referer_with_path_is_allowed() -> None:
    settings = _settings()
    assert _is_origin_allowed(
        "https://tts.ihsanwardhana.web.id/teacher/competitions", settings
    )


def test_origin_from_cors_list_is_allowed() -> None:
    settings = _settings(
        app_origin="http://localhost:5173",
        app_url="http://localhost:5173",
        cors_origins="https://tts-agri.vercel.app",
    )
    assert _is_origin_allowed("https://tts-agri.vercel.app", settings)


@pytest.mark.parametrize(
    "hostile",
    [
        "https://tts.ihsanwardhana.web.id.evil.com",
        "https://evil.com",
        "https://tts.ihsanwardhana.web.id-evil.com",
        "http://tts.ihsanwardhana.web.id",
    ],
)
def test_prefix_and_scheme_bypasses_are_rejected(hostile: str) -> None:
    """An attacker host that merely *starts with* the allowed URL must be rejected."""
    assert not _is_origin_allowed(hostile, _settings())


def test_missing_origin_is_allowed_for_non_browser_clients() -> None:
    assert _is_origin_allowed("", _settings())


def test_localhost_and_loopback_are_interchangeable() -> None:
    settings = _settings(app_origin="http://localhost:5173", app_url="")
    assert _is_origin_allowed("http://127.0.0.1:5173", settings)
    assert _is_origin_allowed("http://localhost:5173", settings)


def test_settings_normalize_trailing_slash() -> None:
    """A trailing slash in TTS_APP_ORIGIN must not survive to the origin checks."""
    settings = _settings(
        app_origin="https://tts.ihsanwardhana.web.id/",
        app_url="https://tts.ihsanwardhana.web.id/",
    )
    assert settings.app_origin == "https://tts.ihsanwardhana.web.id"
    assert settings.app_url == "https://tts.ihsanwardhana.web.id"
    assert settings.public_app_url == "https://tts.ihsanwardhana.web.id"


def test_write_gate_accepts_configured_origin_despite_trailing_slash() -> None:
    """Regression: the CSRF/write gate used startswith() and rejected everything."""
    settings = _settings(app_origin="https://tts.ihsanwardhana.web.id/")
    assert _is_origin_allowed("https://tts.ihsanwardhana.web.id", settings)
