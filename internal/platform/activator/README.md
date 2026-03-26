# Activator — wake-on-demand + LRU pool

**At 216Labs we are building the toolkit for production grade vibes.** This service is the **cold-start orchestrator** for the monorepo: when Caddy sees a dead upstream (502/503/504), users hit `/warmup`, which calls `POST /api/start/<app_id>` so `docker compose up` runs for that app.

**Admin DB optional for wake:** `resolve_docker_service()` reads `docker_service` from `216labs.db` first; if the app row is missing, it loads `manifest.json` from the repo (same paths as `scripts/app-lookup.py`). Apps with `internal_port` ≤ 0 are skipped (workers without HTTP). This lets you ship new demos in git before the admin backfill runs, as long as the image exists on the host.

## Four pillars (how this maps to the architecture)

1. **Off-server builds** — Images are built in **CI** (GitHub Actions → GHCR), not on the droplet. The activator runs `docker compose up --no-build` and pulls from GHCR when needed.

2. **Wake-on-demand** — Caddy (reverse proxy) + this Flask app. Traffic waits on the warmup page while the container starts; no custom Go proxy is required.

3. **Cold-start pull** — On a **cold** service (not already running and healthy), the activator calls **`docker pull`** from GHCR (`ACTIVATOR_REGISTRY_PREFIX/<service>:latest`) **before** the first `compose up`, so local stale `216labs/<service>:latest` tags are refreshed from CI. Set `ACTIVATOR_PULL_BEFORE_COLD_START=false` to disable (emergency only). If `compose up` still fails, it retries pull + optional `ACTIVATOR_TRY_DOCKER_PULL` (Docker Hub). Use `GHCR_TOKEN` (read:packages) + `GHCR_USERNAME` for private packages. Images are published by `.github/workflows/ghcr-publish.yml`.

4. **LRU reaper** — **Compose defaults to `ACTIVATOR_MAX_CONCURRENT_APPS=12`** (evictable app containers; protected services do not count). Set `0` in `.env` for unlimited (not recommended on small disks). Opening many subdomains in a row will **stop** older containers to stay under the limit unless you raise the cap or add services to `ACTIVATOR_PROTECTED_SERVICES`. Before starting another app the activator **stops** the least-recently-used evictable compose service (by `last_accessed_at`). A background thread repeats the same rule if the pool exceeds the cap.

**Protected services** (never evicted): `caddy`, `activator`, `admin`, `landing` by default (`ACTIVATOR_PROTECTED_SERVICES`).

**Blocked starts** (warmup/API will not `compose up`): `caddy`, `activator` by default (`ACTIVATOR_BLOCK_START_SERVICES`). Admin and landing can still be cold-started if their subdomain ever 502s.

**Warmup `dest`**: only `https://{app_id}.{APP_HOST}` is accepted; other URLs fall back to that default (open-redirect safe).

**Optional disk reclaim**: `ACTIVATOR_REMOVE_IMAGE_ON_EVICT=true` runs `docker rmi` on eviction (next cold start may need a pull).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/start/<app_id>` | Start container; may LRU-evict first |
| `GET` | `/api/status/<app_id>?touch=1` | Status; `touch=1` updates `last_accessed_at` |
| `POST` | `/api/touch/<app_id>` | Update `last_accessed_at` only (204) — for optional future Caddy hooks |
| `GET` | `/warmup` | HTML page that starts + polls until ready |

Per-request LRU without extra latency would require Caddy subrequests or a sidecar; today recency is driven by warmup/status touches and starts.

## Registry pulls

`216labs/*` images are **not** on Docker Hub by default. Use **GHCR** (`ghcr-publish` workflow → `ACTIVATOR_REGISTRY_PREFIX` + optional PAT on the server). On cold start, the activator **pulls GHCR first**, then `compose up`. After a failed `compose up`, it retries GHCR retag, then optional hub pull if `ACTIVATOR_TRY_DOCKER_PULL=true`.

Compose sets `pull_policy: never` on each `216labs/*` service so a plain `docker compose up` does not try to pull private tags unexpectedly.

## Environment

See `docker-compose.yml` `activator` service. Key variables:

- `ACTIVATOR_MAX_CONCURRENT_APPS` — default **12** in compose; set `0` in `.env` for unlimited (RAM/disk risk on small VPS).
- `ACTIVATOR_REAPER_INTERVAL_SECONDS` — background trim interval (set `0` to disable reaper thread).
- `ACTIVATOR_PROTECTED_SERVICES` — comma-separated compose service names.
- `ACTIVATOR_BLOCK_START_SERVICES` — compose services that refuse `/api/start` (default `caddy,activator`).
- `ACTIVATOR_REGISTRY_PREFIX` — e.g. `ghcr.io/6cubed/216labs` for cold-start pull.
- `ACTIVATOR_PULL_BEFORE_COLD_START` — default `true`: pull GHCR `latest` before first `compose up` on a cold service.
- `GHCR_USERNAME` / `GHCR_TOKEN` — droplet login for private packages (`read:packages`).
