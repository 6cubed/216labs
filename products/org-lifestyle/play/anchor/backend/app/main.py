from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sqlalchemy import text

from .database import Base, engine
from .routers import auth, posts
from .http_errors import register_fastapi_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Anchor API",
    description="Location-based discussion platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(posts.router, prefix="/api/v1/posts", tags=["posts"])

register_fastapi_exception_handlers(app)


@app.get("/api/v1/health", tags=["health"])
@app.get("/healthz", tags=["health"], include_in_schema=False)
async def health():
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def home():
    # Public HTML used to be Flutter (anchor-web), which is not on GHCR — so
    # Caddy 502'd. Serve a real page from the API so a cold start is useful.
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Anchor — location discussions</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1.25rem; line-height: 1.5; color: #e4e4e7; background: #0a0a0c; }
    a { color: #a78bfa; }
    .muted { color: #71717a; }
  </style>
</head>
<body>
  <h1>Anchor</h1>
  <p>Anonymous discussions tied to where you are. Posts live in a 5&nbsp;km radius — no accounts, no feed of the whole internet.</p>
  <p><a href="/docs">API docs</a> · <a href="/api/v1/health">health</a></p>
  <p class="muted">Built by <a href="https://6cubed.app">216Labs</a></p>
</body>
</html>
"""
