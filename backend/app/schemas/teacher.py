from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class GroupUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    status: str | None = None


class CompetitionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    puzzle_set_id: int
    group_ids: list[int] = Field(min_length=1)
    duration_minutes: int = Field(default=15, ge=1, le=180)
    leaderboard_public: bool = False


class CompetitionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    duration_minutes: int | None = Field(default=None, ge=1, le=180)
    leaderboard_public: bool | None = None


class ExtendRequest(BaseModel):
    minutes: int = Field(ge=1, le=180)


class VoidRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=300)
