from __future__ import annotations

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)

_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous chars
_DIGITS = "0123456789"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(24)


def generate_code(length: int, alphabet: str = _ALPHA) -> str:
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_pin(digits: int = 6) -> str:
    return "".join(secrets.choice(_DIGITS) for _ in range(digits))


def constant_time_eq(a: str, b: str) -> bool:
    return secrets.compare_digest(a, b)
