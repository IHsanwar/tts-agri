from __future__ import annotations

from datetime import UTC, datetime


def utcnow() -> datetime:
    """Return current UTC time as naive datetime for seamless MySQL DateTime compatibility."""
    return datetime.now(UTC).replace(tzinfo=None)


def now_ms() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


def to_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat()
