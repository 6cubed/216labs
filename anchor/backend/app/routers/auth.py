from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..config import settings
from ..database import get_db
from ..models import User
from ..schemas import DeviceRegisterRequest, TokenResponse

router = APIRouter()


def _create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.access_token_expire_days)
    return jwt.encode({"sub": user_id, "exp": expire}, settings.secret_key, algorithm=settings.algorithm)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def register(body: DeviceRegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register an anonymous device.  The client generates a stable UUID (device_id)
    on first launch and persists it locally.  Calling this endpoint again with the
    same device_id returns a fresh JWT for the same user — no phone or password needed.
    """
    result = await db.execute(select(User).where(User.device_id == body.device_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(device_id=body.device_id)
        db.add(user)
        await db.flush()

    token = _create_token(str(user.id))
    return TokenResponse(access_token=token, user_id=str(user.id))
