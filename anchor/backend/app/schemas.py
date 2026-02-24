from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class PostCreate(BaseModel):
    content: str
    lat: float
    lng: float
    parent_id: Optional[UUID] = None

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Content cannot be empty")
        if len(v) > 1000:
            raise ValueError("Content must be 1000 characters or fewer")
        return v


class PostResponse(BaseModel):
    id: UUID
    content: str
    lat: float
    lng: float
    created_at: datetime
    parent_id: Optional[UUID]
    upvotes: int = 0
    downvotes: int = 0
    reply_count: int = 0

    model_config = {"from_attributes": True}


class VoteCreate(BaseModel):
    value: int  # +1 or -1

    @field_validator("value")
    @classmethod
    def value_must_be_valid(cls, v: int) -> int:
        if v not in (1, -1):
            raise ValueError("Vote value must be +1 or -1")
        return v


class DeviceRegisterRequest(BaseModel):
    """
    The client generates a random UUID on first launch and stores it locally.
    Posting the same device_id always returns a JWT for the same anonymous user.
    """
    device_id: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
