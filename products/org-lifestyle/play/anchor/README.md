# Anchor

A location-based anonymous discussion app. See what people are talking about within 5km of you.

## Concept

- Posts are anonymous and tied to the poster's GPS location at the time of posting.
- Users see only posts within a 5km radius of their current (or anchored) location.
- Threaded format: one OP, unlimited replies.
- Upvotes/downvotes on posts and replies. Sort by top or most recent.
- SMS verification required to post (read-only access is open).

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | Flutter (Web / Android / iOS) — served via nginx |
| Backend  | FastAPI + Uvicorn (async) |
| Database | PostgreSQL 16 + PostGIS for geographic queries |
| ORM      | SQLAlchemy (async) + GeoAlchemy2 |
| Auth     | JWT (python-jose) + anonymous device tokens (no external service) |

Served on port **:8013** behind Caddy:
- `GET|POST /api/*` → `anchor-api:8000`
- everything else → `anchor-web:80` (Flutter web)

## API

Interactive docs: `http://localhost:8013/api/v1/docs`

### Auth

```
POST /api/v1/auth/register   { device_id: "<uuid>" }   → { access_token, user_id }
```

The client generates a random UUID on first launch and persists it in local storage.
Calling register again with the same `device_id` returns a fresh JWT for the same anonymous user — no phone, email, or password needed.

All write operations require `Authorization: Bearer <token>` header.

### Posts feed

```
GET  /api/v1/posts?lat=53.3&lng=-6.2&sort=recent|top&page=1&page_size=20
POST /api/v1/posts          { content, lat, lng, parent_id? }
GET  /api/v1/posts/{id}
GET  /api/v1/posts/{id}/replies?sort=recent|top
POST /api/v1/posts/{id}/vote    { value: 1 | -1 }
```

Replies share the same `Post` model with a `parent_id`. Nesting is one level deep.

## Environment variables

| Variable               | Description                                           | Default |
|------------------------|-------------------------------------------------------|---------|
| `ANCHOR_DATABASE_URL`  | PostgreSQL asyncpg URL (set via docker-compose)       | —       |
| `ANCHOR_SECRET_KEY`    | JWT signing secret — **change in production**         | `dev-secret-change-me` |
| `ANCHOR_RADIUS_METERS` | Radius for nearby posts in metres                     | `5000` |

## Local dev

```bash
# Start postgres + PostGIS (or use the full compose stack)
docker compose up postgres -d

# Backend
cd anchor/backend
pip install -r requirements.txt
ANCHOR_DATABASE_URL="postgresql+asyncpg://labs:labs@localhost:5432/anchor" \
  uvicorn app.main:app --reload
# → http://localhost:8000/api/v1/docs

# Frontend (requires Flutter SDK)
cd anchor/frontend
flutter run -d chrome
```

## Milestones

### Prototype (target: June, Zurich)
- [x] Core API — posts, replies, votes, 5km radius filter (PostGIS `ST_DWithin`)
- [x] Flutter web client — feed, post detail, new post, anonymous auth (one-tap)
- [x] No external service keys required — zero-config for prototype
- [ ] Push notifications for reply threads
- [ ] Android / iOS builds

### Experimental
- [ ] Geofence-based group chats (non-overlapping, 24h presence requirement)
- [ ] Location insights ("you were both at X yesterday")
- [ ] Report / auto-hide after threshold downvotes

### Growth & Monetisation
- [ ] Local ad targeting (geo-matched sponsored posts every ~10 scroll items)
- [ ] Premium radius > 5km or multiple anchored locations
