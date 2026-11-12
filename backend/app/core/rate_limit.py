from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta

from app.core.config import get_settings


@dataclass
class _Bucket:
    tokens: float
    last: float


@dataclass
class RateLimiter:
    capacity: float
    refill_per_second: float
    _buckets: dict[str, _Bucket] = field(default_factory=dict)

    def _take(self, key: str, amount: float = 1.0) -> bool:
        import time

        now = time.monotonic()
        b = self._buckets.get(key)
        if b is None:
            b = _Bucket(self.capacity, now)
            self._buckets[key] = b
        elapsed = now - b.last
        b.tokens = min(self.capacity, b.tokens + elapsed * self.refill_per_second)
        b.last = now
        if b.tokens >= amount:
            b.tokens -= amount
            return True
        return False

    def allow(self, key: str, amount: float = 1.0) -> bool:
        return self._take(key, amount)

    def reset(self, key: str) -> None:
        self._buckets.pop(key, None)


def per_minute(rate: int) -> RateLimiter:
    return RateLimiter(capacity=float(rate), refill_per_second=rate / 60.0)


_join_ip = per_minute(get_settings().rate_join_per_minute_ip)
_join_group = per_minute(get_settings().rate_join_per_minute_group)
_register_ip = per_minute(get_settings().rate_register_per_minute_ip)
_events_session = per_minute(get_settings().rate_events_per_minute_session)
_wrong_session = per_minute(get_settings().rate_wrong_attempts_per_minute_session)


def cleanup(max_keys: int = 5000) -> None:
    """Drop old buckets to bound memory."""
    for limiter in (_join_ip, _join_group, _register_ip, _events_session, _wrong_session):
        if len(limiter._buckets) > max_keys:  # noqa: SLF001
            limiter._buckets.clear()  # noqa: SLF001


def parse_duration(seconds: int) -> timedelta:
    return timedelta(seconds=seconds)
