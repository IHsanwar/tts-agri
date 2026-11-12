from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PuzzleContent(BaseModel):
    """Thin wrapper so FastAPI parses and applies size constraints."""

    model_config = {"extra": "allow"}

    schema_version: int = 1
    version: str = Field(..., min_length=1, max_length=60)
    title: str = Field(..., min_length=1, max_length=120)
    language: str = "en"
    grid: list[str]
    entries: list[dict[str, Any]]
