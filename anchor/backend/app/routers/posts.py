from typing import Annotated, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from geoalchemy2.functions import ST_AsGeoJSON, ST_DWithin, ST_MakePoint, ST_SetSRID
from sqlalchemy import cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import settings
from ..database import get_db
from ..deps import get_current_user, get_current_user_optional
from ..models import Post, User, Vote
from ..schemas import PostCreate, PostResponse, VoteCreate

router = APIRouter()


def _point_geog(lat: float, lng: float):
    """Build a PostGIS geography point from lat/lng."""
    return cast(func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326), text("geography"))


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
    # Extract lat/lng from WKB geography
    coords = await db.execute(select(func.ST_AsText(post.location)))
    wkt = coords.scalar()  # "POINT(lng lat)"
    lng_val, lat_val = map(float, wkt.replace("POINT(", "").replace(")", "").split())
    return PostResponse(
        id=post.id,
        content=post.content,
        lat=lat_val,
        lng=lng_val,
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
    point = _point_geog(lat, lng)

    # Vote score subquery
    vote_score = (
        select(Vote.post_id, func.sum(Vote.value).label("score"))
        .group_by(Vote.post_id)
        .subquery()
    )

    query = (
        select(Post)
        .where(ST_DWithin(Post.location, point, settings.radius_meters))
        .where(Post.parent_id.is_(None))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    if sort == "top":
        query = (
            query.outerjoin(vote_score, Post.id == vote_score.c.post_id)
            .order_by((vote_score.c.score).desc().nulls_last(), Post.created_at.desc())
        )
    else:
        query = query.order_by(Post.created_at.desc())

    result = await db.execute(query)
    posts = result.scalars().all()
    return [await _serialize_post(p, db) for p in posts]


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    body: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.parent_id:
        parent = await db.get(Post, body.parent_id)
        if parent is None:
            raise HTTPException(status_code=404, detail="Parent post not found")
        if parent.parent_id is not None:
            raise HTTPException(status_code=400, detail="Replies cannot be nested deeper than one level")

    location = func.ST_SetSRID(func.ST_MakePoint(body.lng, body.lat), 4326)
    post = Post(
        content=body.content,
        location=location,
        user_id=current_user.id,
        parent_id=body.parent_id,
    )
    db.add(post)
    await db.flush()
    return await _serialize_post(post, db)


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(post_id: UUID, db: AsyncSession = Depends(get_db)):
    post = await db.get(Post, post_id)
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
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    query = (
        select(Post)
        .where(Post.parent_id == post_id)
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
            .order_by((vote_score.c.score).desc().nulls_last(), Post.created_at.asc())
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
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    result = await db.execute(
        select(Vote).where(Vote.user_id == current_user.id, Vote.post_id == post_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        if existing.value == body.value:
            await db.delete(existing)  # toggle off
        else:
            existing.value = body.value
    else:
        db.add(Vote(user_id=current_user.id, post_id=post_id, value=body.value))

    await db.flush()
    return await _serialize_post(post, db)
