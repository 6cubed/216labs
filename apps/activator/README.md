# Activator — wake-on-demand + LRU pool

This service is the **cold-start orchestrator** for 216labs: when Caddy sees a dead upstream (502/503/504), users hit `/warmup`, which calls `POST /api/start/<app_id>` so `docker compose up` runs for that app.

**Admin DB optional for wake:** `resolve_docker_service()` reads `docker_service` from `216labs.db` first; if the app row is missing, it loads `manifest.json` from the repo (same paths as `scripts/app-lookup.py`). Apps with `internal_port` ≤ 0 are skipped (workers without HTTP). This lets you ship new demos in git before the admin backfill runs, as long as the image exists on the host.

## Four pillars (how this maps to the architecture)

1. **Off-server builds** — Images are built on your laptop or CI (`./deploy.sh`), not on the droplet. The activator only runs `docker compose up --no-build` and optional `docker pull` for missing layers.

2. **Wake-on-demand** — Caddy (reverse proxy) + this Flask app. Traffic waits on the warmup page while the container starts; no custom Go proxy is required.

3. **Cold-start pull** — If `docker compose up` fails (no local image), the activator tries **GHCR** when `ACTIVATOR_REGISTRY_PREFIX` is set (e.g. `ghcr.io/6cubed/216labs`): `docker pull` that tag, `docker tag` to `216labs/<service>:latest`, then `compose up` again. Use `GHCR_TOKEN` (read:packages) + `GHCR_USERNAME` on the droplet. Images are published by `.github/workflows/ghcr-publish.yml`. Optional legacy: `ACTIVATOR_TRY_DOCKER_PULL=true` still attempts Docker Hub `216labs/*` (usually empty).

4. **LRU reaper (optional)** — **Compose defaults to `ACTIVATOR_MAX_CONCURRENT_APPS=0` (off).** If you set a cap (e.g. `10` on a 1GB droplet), opening many subdomains in a row will **stop** older containers to stay under the limit—so hopping between apps feels broken unless you raise the cap or add services to `ACTIVATOR_PROTECTED_SERVICES`. When enabled, before starting another app the activator **stops** the least-recently-used evictable compose service (by `last_accessed_at`). A background thread repeats the same rule if the pool exceeds the cap.

**Protected services** (never evicted): `caddy`, `activator`, `admin`, `landing` by default (`ACTIVATOR_PROTECTED_SERVICES`).

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

`216labs/*` images are **not** on Docker Hub by default. Prefer **`./deploy.sh`** (loads images to the droplet) or **GHCR** (`ghcr-publish` workflow → set `ACTIVATOR_REGISTRY_PREFIX` + PAT on the server). The activator runs `docker pull` only after a failed `compose up`, in this order: GHCR retag, then optional hub pull if `ACTIVATOR_TRY_DOCKER_PULL=true`.

Compose sets `pull_policy: never` on each `216labs/*` service so a plain `docker compose up` does not try to pull private tags unexpectedly.

## Environment

See `docker-compose.yml` `activator` service. Key variables:

- `ACTIVATOR_MAX_CONCURRENT_APPS` — `0` = unlimited (default); set e.g. `10` in `.env` only when you need a RAM cap.
- `ACTIVATOR_REAPER_INTERVAL_SECONDS` — background trim interval (set `0` to disable reaper thread).
- `ACTIVATOR_PROTECTED_SERVICES` — comma-separated compose service names.
- `ACTIVATOR_REGISTRY_PREFIX` — e.g. `ghcr.io/6cubed/216labs` for cold-start pull.
- `GHCR_USERNAME` / `GHCR_TOKEN` — droplet login for private packages (`read:packages`).
