from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class JoinRequest(BaseModel):
    competition_code: str = Field(min_length=1, max_length=30)
    group_code: str = Field(min_length=1, max_length=30)
    pin: str = Field(min_length=1, max_length=30)


class PlayEvent(BaseModel):
    event_id: str = Field(min_length=1, max_length=64)
    type: str = Field(min_length=1, max_length=30)
    payload: dict[str, Any] = Field(default_factory=dict)
    seq: int = 0


class PlayEventsRequest(BaseModel):
    events: list[PlayEvent] = Field(min_length=1, max_length=20)
