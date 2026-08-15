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


HOME_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Anchor — nearby posts</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1.25rem 3rem; line-height: 1.5; color: #e4e4e7; background: #0a0a0c; }
    a { color: #a78bfa; }
    .muted { color: #71717a; font-size: 0.92rem; }
    h1 { margin: 0 0 0.35rem; }
    textarea { width: 100%; box-sizing: border-box; min-height: 5rem; margin: 0.75rem 0 0.5rem; padding: 0.7rem; border-radius: 8px; border: 1px solid #3f3f46; background: #18181b; color: #fafafa; font: inherit; }
    button { background: #7c3aed; color: #fff; border: 0; border-radius: 8px; padding: 0.55rem 1rem; font: inherit; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .post { border-top: 1px solid #27272a; padding: 0.9rem 0; }
    .err { color: #fca5a5; }
    #status { margin: 0.75rem 0; }
  </style>
</head>
<body>
  <h1>Anchor</h1>
  <p class="muted">Anonymous posts within 5 km of you. No accounts. Location stays in the browser except as lat/lng on each post.</p>
  <p id="status" class="muted">Share location to see what’s nearby.</p>
  <form id="compose" hidden>
    <textarea id="content" maxlength="1000" placeholder="What’s happening here?" required></textarea>
    <button type="submit" id="send">Post</button>
  </form>
  <div id="feed"></div>
  <p class="muted" style="margin-top:2rem"><a href="https://6cubed.app">216Labs</a></p>
  <script>
    const feed = document.getElementById("feed");
    const status = document.getElementById("status");
    const compose = document.getElementById("compose");
    const send = document.getElementById("send");
    let lat = null, lng = null, token = null;

    function deviceId() {
      let id = localStorage.getItem("anchor_device_id");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("anchor_device_id", id);
      }
      return id;
    }

    async function register() {
      const r = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ device_id: deviceId() }),
      });
      if (!r.ok) throw new Error("Could not start a session");
      const j = await r.json();
      token = j.access_token;
    }

    async function load() {
      const r = await fetch("/api/v1/posts/?lat=" + lat + "&lng=" + lng);
      if (!r.ok) throw new Error("Could not load posts");
      const posts = await r.json();
      if (!posts.length) {
        feed.innerHTML = "<p class=muted>Nothing within 5 km yet. Be the first.</p>";
        return;
      }
      feed.innerHTML = posts.map(function (p) {
        const when = new Date(p.created_at).toLocaleString();
        const text = p.content.replace(/&/g,"&amp;").replace(/</g,"&lt;");
        return "<article class=post><div>" + text + "</div><div class=muted>" + when + "</div></article>";
      }).join("");
    }

    compose.addEventListener("submit", async function (e) {
      e.preventDefault();
      const content = document.getElementById("content").value.trim();
      if (!content || token == null) return;
      send.disabled = true;
      try {
        const r = await fetch("/api/v1/posts/", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + token },
          body: JSON.stringify({ content: content, lat: lat, lng: lng }),
        });
        if (!r.ok) throw new Error("Post failed");
        document.getElementById("content").value = "";
        await load();
      } catch (err) {
        status.innerHTML = "<span class=err>" + err.message + "</span>";
      }
      send.disabled = false;
    });

    if (!navigator.geolocation) {
      status.innerHTML = "<span class=err>This browser cannot share location.</span>";
    } else {
      navigator.geolocation.getCurrentPosition(async function (pos) {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        status.textContent = "Within 5 km of you.";
        compose.hidden = false;
        try {
          await register();
          await load();
        } catch (err) {
          status.innerHTML = "<span class=err>" + err.message + "</span>";
        }
      }, function () {
        status.innerHTML = "<span class=err>Location permission is required to see nearby posts.</span>";
      }, { enableHighAccuracy: false, timeout: 10000 });
    }
  </script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def home():
    # Flutter web is not on GHCR. This page is the product: nearby posts in the browser.
    return HOME_HTML
