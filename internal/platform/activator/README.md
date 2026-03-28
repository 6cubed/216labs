# Activator — showroom hotswap + cold start

**At 216Labs we are building the toolkit for production grade vibes.** This service is the **cold-start orchestrator** for the monorepo: when Caddy sees a dead upstream (502/503/504), users hit `/warmup`, which calls `POST /api/start/<app_id>` so `docker compose up` runs for that app.

## Showroom goal (why LRU exists)

The **showroom** is the ability to **browse 100+ apps** from one small droplet. You cannot keep every container **running** at once (RAM), but you **can** keep a **small hot pool** and **hotswap**: when someone opens an app that is not already up, the activator **evicts** the least-recently-used **evictable** container (if the pool is over cap), **pulls** the image from GHCR if needed (`ACTIVATOR_REGISTRY_PREFIX` → retag to `216labs/<service>:latest`), then **`compose up`** the requested service. That is **intentional churn** — not a mistake — so the **requested** demo wins over **idle** demos.

- **`ACTIVATOR_MAX_CONCURRENT_APPS`** (compose default **10**) = max **evictable** app containers **running** at once (protected services do not count). Set **`0`** only if you want **no** LRU eviction (e.g. dev box or plenty of RAM) and accept many concurrent app processes.
- **`ACTIVATOR_PROTECTED_SERVICES`** — edge stays up (`caddy`, `activator`, `admin`, `landing` by default); they are never LRU-stopped.
- **`activator_never_evict` in `manifest.json`** — opt a specific product **out** of eviction when a cap is enabled (e.g. a flagship demo you always want to keep warm if it was touched recently).

**Hotswapping** here means: **swap which app containers are running** inside the cap so the **current request** can be satisfied, including **pull-on-demand** from GHCR when the image is not on disk.

**Admin DB optional for wake:** `resolve_docker_service()` reads `docker_service` from `216labs.db` first; if the app row is missing, it loads `manifest.json` from the repo (same paths as `scripts/app-lookup.py`). Apps with `internal_port` ≤ 0 are skipped (workers without HTTP). This lets you ship new demos in git before the admin backfill runs, as long as the image exists on the host (or can be pulled).

## Four pillars (how this maps to the architecture)

1. **Off-server builds** — Images are built in **CI** (GitHub Actions → GHCR), not on the droplet. The activator runs `docker compose up --no-build` and pulls from GHCR when needed.

2. **Wake-on-demand** — Caddy (reverse proxy) + this Flask app. Traffic waits on the warmup page while the container starts; no custom Go proxy is required.

3. **Cold-start pull** — On a **cold** service (not already running and healthy), the activator calls **`docker pull`** from GHCR (`ACTIVATOR_REGISTRY_PREFIX/<service>:latest`) **before** the first `compose up`, so local stale `216labs/<service>:latest` tags are refreshed from CI. Set `ACTIVATOR_PULL_BEFORE_COLD_START=false` to disable (emergency only). If `compose up` still fails, it retries pull + optional `ACTIVATOR_TRY_DOCKER_PULL` (Docker Hub). Use `GHCR_TOKEN` (read:packages) + `GHCR_USERNAME` for private packages. Images are published by `.github/workflows/ghcr-publish.yml`.

4. **LRU pool (showroom)** — With a **positive** `ACTIVATOR_MAX_CONCURRENT_APPS`, before starting another app the activator **stops** the least-recently-used evictable compose service (by `last_accessed_at`) until the pool is under the cap. A **background reaper** applies the same rule if something pushes the pool over the cap. This is how **many catalog apps** share **one** machine: **aggressive eviction** to make room for **the app being requested**, plus **GHCR** if the image was never loaded.

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

- `ACTIVATOR_MAX_CONCURRENT_APPS` — default **10** in compose: **showroom** hot pool size (evictable apps only). Set **`0`** for unlimited concurrent evictable containers (not the normal showroom mode).
- `ACTIVATOR_REAPER_INTERVAL_SECONDS` — background trim interval (set `0` to disable reaper thread).
- `ACTIVATOR_PROTECTED_SERVICES` — comma-separated compose service names (never LRU-stopped).
- `ACTIVATOR_BLOCK_START_SERVICES` — compose services that refuse `/api/start` (default `caddy,activator`).
- `ACTIVATOR_REGISTRY_PREFIX` — e.g. `ghcr.io/6cubed/216labs` for cold-start pull.
- `ACTIVATOR_PULL_BEFORE_COLD_START` — default `true`: pull GHCR `latest` before first `compose up` on a cold service.
- `ACTIVATOR_START_TIMEOUT_SECONDS` — how long to wait for HTTP after `compose up` (and one restart recovery path in code).
- `GHCR_USERNAME` / `GHCR_TOKEN` — droplet login for private packages (`read:packages`).
