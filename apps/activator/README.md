# Activator — wake-on-demand + LRU pool

This service is the **cold-start orchestrator** for 216labs: when Caddy sees a dead upstream (502/503/504), users hit `/warmup`, which calls `POST /api/start/<app_id>` so `docker compose up` runs for that app.

## Four pillars (how this maps to the architecture)

1. **Off-server builds** — Images are built on your laptop or CI (`./deploy.sh`), not on the droplet. The activator only runs `docker compose up --no-build` and optional `docker pull` for missing layers.

2. **Wake-on-demand** — Caddy (reverse proxy) + this Flask app. Traffic waits on the warmup page while the container starts; no custom Go proxy is required.

3. **Cold-start pull** — `try_pull_image` + `docker compose up` after eviction makes room (see below).

4. **LRU reaper** — When `ACTIVATOR_MAX_CONCURRENT_APPS` is set (e.g. `10` on a 1GB droplet), before starting another app the activator **stops** the least-recently-used evictable compose service (by `last_accessed_at` in `216labs.db`). A background thread repeats the same rule if the pool ever exceeds the cap.

**Protected services** (never evicted): `caddy`, `activator`, `admin` by default (`ACTIVATOR_PROTECTED_SERVICES`).

**Optional disk reclaim**: `ACTIVATOR_REMOVE_IMAGE_ON_EVICT=true` runs `docker rmi` on eviction (next cold start may need a pull).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/start/<app_id>` | Start container; may LRU-evict first |
| `GET` | `/api/status/<app_id>?touch=1` | Status; `touch=1` updates `last_accessed_at` |
| `POST` | `/api/touch/<app_id>` | Update `last_accessed_at` only (204) — for optional future Caddy hooks |
| `GET` | `/warmup` | HTML page that starts + polls until ready |

Per-request LRU without extra latency would require Caddy subrequests or a sidecar; today recency is driven by warmup/status touches and starts.

## Environment

See `docker-compose.yml` `activator` service. Key variables:

- `ACTIVATOR_MAX_CONCURRENT_APPS` — `0` = unlimited; default in compose is `10`.
- `ACTIVATOR_REAPER_INTERVAL_SECONDS` — background trim interval (set `0` to disable reaper thread).
- `ACTIVATOR_PROTECTED_SERVICES` — comma-separated compose service names.
