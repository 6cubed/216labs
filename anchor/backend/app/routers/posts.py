from math import asin, cos, radians, sin, sqrt
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..deps import get_current_user, get_current_user_optional
from ..models import Post, User, Vote
from ..schemas import PostCreate, PostResponse, VoteCreate

router = APIRouter()

EARTH_RADIUS_M = 6_371_000


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return EARTH_RADIUS_M * 2 * asin(sqrt(a))


def bounding_box(lat: float, lng: float, radius_m: float) -> tuple[float, float, float, float]:
    """Rectangular pre-filter bounds to reduce rows scanned before the exact Haversine check."""
    lat_delta = radius_m / 111_000
    lng_delta = radius_m / (111_000 * cos(radians(lat)))
    return lat - lat_delta, lat + lat_delta, lng - lng_delta, lng + lng_delta


async def _serialize_post(post: Post, db: AsyncSession) -> PostResponse:
    upvotes = await db.scalar(
        select(func.count()).where(Vote.post_id == post.id, Vote.value == 1)
    )
    downvotes = await db.scalar(
        select(func.count()).where(Vote.post_id == post.id, Vote.value == -1)
    )
    reply_count = await db.scalar(
        select(func.count()).where(Post.parent_id == post.id)
    )
    return PostResponse(
        id=post.id,
        content=post.content,
        lat=post.lat,
        lng=post.lng,
        created_at=post.created_at,
        parent_id=post.parent_id,
        upvotes=upvotes or 0,
        downvotes=downvotes or 0,
        reply_count=reply_count or 0,
    )


@router.get("/", response_model=list[PostResponse])
async def list_posts(
    lat: float = Query(..., description="Observer latitude"),
    lng: float = Query(..., description="Observer longitude"),
    sort: Literal["recent", "top"] = Query("recent"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: Optional[User] = Depends(get_current_user_optional),
):
    lat_min, lat_max, lng_min, lng_max = bounding_box(lat, lng, settings.radius_meters)

    vote_score = (
        select(Vote.post_id, func.sum(Vote.value).label("score"))
        .group_by(Vote.post_id)
        .subquery()
    )

    query = (
        select(Post)
        .where(
            Post.lat.between(lat_min, lat_max),
            Post.lng.between(lng_min, lng_max),
            Post.parent_id.is_(None),
        )
    )

    if sort == "top":
        query = (
            query.outerjoin(vote_score, Post.id == vote_score.c.post_id)
            .order_by(vote_score.c.score.desc().nulls_last(), Post.created_at.desc())
        )
    else:
        query = query.order_by(Post.created_at.desc())

    result = await db.execute(query)
    all_posts = result.scalars().all()

    # Exact Haversine filter after rectangular pre-filter; paginate in Python
    nearby = [p for p in all_posts if haversine_meters(lat, lng, p.lat, p.lng) <= settings.radius_meters]
    offset = (page - 1) * page_size
    page_posts = nearby[offset: offset + page_size]

    return [await _serialize_post(p, db) for p in page_posts]


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    body: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.parent_id:
        parent = await db.get(Post, str(body.parent_id))
        if parent is None:
            raise HTTPException(status_code=404, detail="Parent post not found")
        if parent.parent_id is not None:
            raise HTTPException(status_code=400, detail="Replies cannot be nested deeper than one level")

    post = Post(
        content=body.content,
        lat=body.lat,
        lng=body.lng,
        user_id=current_user.id,
        parent_id=str(body.parent_id) if body.parent_id else None,
    )
    db.add(post)
    await db.flush()
    return await _serialize_post(post, db)


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(post_id: UUID, db: AsyncSession = Depends(get_db)):
    post = await db.get(Post, str(post_id))
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return await _serialize_post(post, db)


@router.get("/{post_id}/replies", response_model=list[PostResponse])
async def list_replies(
    post_id: UUID,
    sort: Literal["recent", "top"] = Query("recent"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, str(post_id))
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    query = (
        select(Post)
        .where(Post.parent_id == str(post_id))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if sort == "top":
        vote_score = (
            select(Vote.post_id, func.sum(Vote.value).label("score"))
            .group_by(Vote.post_id)
            .subquery()
        )
        query = (
            query.outerjoin(vote_score, Post.id == vote_score.c.post_id)
            .order_by(vote_score.c.score.desc().nulls_last(), Post.created_at.asc())
        )
    else:
        query = query.order_by(Post.created_at.asc())

    result = await db.execute(query)
    replies = result.scalars().all()
    return [await _serialize_post(r, db) for r in replies]


@router.post("/{post_id}/vote", response_model=PostResponse)
async def vote_post(
    post_id: UUID,
    body: VoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, str(post_id))
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    result = await db.execute(
        select(Vote).where(Vote.user_id == current_user.id, Vote.post_id == str(post_id))
    )
    existing = result.scalar_one_or_none()

    if existing:
        if existing.value == body.value:
            await db.delete(existing)  # toggle off
        else:
            existing.value = body.value
    else:
        db.add(Vote(user_id=current_user.id, post_id=str(post_id), value=body.value))

    await db.flush()
    return await _serialize_post(post, db)
