from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

AvatarColor = Literal["coral", "blue", "green", "purple", "gold"]


class CreateSessionRequest(BaseModel):
    display_name: Annotated[str, Field(min_length=2, max_length=40)]

    @field_validator("display_name", mode="before")
    @classmethod
    def normalize_display_name(cls, value: Any) -> Any:
        if isinstance(value, str):
            return " ".join(value.split())
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    avatar_color: AvatarColor


class SessionResponse(BaseModel):
    user: UserResponse


class StreamTokenResponse(BaseModel):
    api_key: str
    token: str
    expires_in: int
    user: UserResponse
