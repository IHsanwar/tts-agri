from __future__ import annotations

import hashlib
import json
from pathlib import Path


def canonical_json_bytes(data: object) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def compute_sha256(data: object) -> str:
    return hashlib.sha256(canonical_json_bytes(data)).hexdigest()


def ensure_data_dir(path: str) -> None:
    p = Path(path)
    if p.parent:
        p.parent.mkdir(parents=True, exist_ok=True)
