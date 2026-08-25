from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from roomtone_api.schemas.session import UserResponse

RoomStatus = Literal["backstage", "live", "ended"]


class CreateRoomRequest(BaseModel):
    title: Annotated[str, Field(min_length=3, max_length=80)]

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: Any) -> Any:
        if isinstance(value, str):
            return " ".join(value.split())
        return value


class RoomResponse(BaseModel):
    id: UUID
    title: str
    status: RoomStatus
    host: UserResponse
    is_host: bool
    created_at: datetime
    went_live_at: datetime | None
    ended_at: datetime | None
