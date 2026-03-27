# Scaling 216labs: 20 → 1000+ Apps

This doc describes the foundations for scaling to hundreds or thousands of apps in one monorepo, with many agents making automated changes in parallel.

## Design principles

1. **Manifest-first** — Adding an app = add `apps/<id>/` + `manifest.json` (+ Dockerfile). No edits to deploy.sh, db.ts, or docker-compose.yml required for the common case.
2. **Config over code** — Deploy priority and optional bootstrap snippets live in config files; **admin `deploy_enabled` + CI (GHCR)** are the normal path.
3. **Discovery over registration** — Apps are discovered from the filesystem and manifests; the admin DB is synced from that. No central hand-maintained app list in code.
4. **Generated over hand-written** — Caddyfile and (at scale) compose app blocks are generated from manifests so new apps don’t require editing big static files.

## What’s in place

| Concern | Current mechanism | Scale behavior |
|--------|-------------------|----------------|
| **Which apps deploy** | Admin DB `deploy_enabled` + optional cap | DB stays source of truth; cap via `DEPLOY_MAX_APPS` (default **10**; override in env) |
| **Showroom / hotswap** | `DEPLOY_SHOWROOM=1` + `DEPLOY_RUNTIME_APPS` (or default `admin landing`) | Keeps a **small hot pool** running and pulls only those images from GHCR; larger `deploy_enabled` catalogue cold-starts via activator (optional GHCR pull on wake). Set `ACTIVATOR_MAX_CONCURRENT_APPS` + optional `ACTIVATOR_REMOVE_IMAGE_ON_EVICT` on the droplet to cap RAM/disk. |
| **GHCR sync on VPS** | [`scripts/droplet-ghcr-sync.sh`](../scripts/droplet-ghcr-sync.sh), [`config/systemd/`](../config/systemd/) timer example | Periodically pulls CI `latest` for **running** `216labs/*` services and recreates them. Activator cold-start uses `ACTIVATOR_PULL_BEFORE_COLD_START`. See [DROPLET_SYNC.md](DROPLET_SYNC.md). |
| **Optional bootstrap** | `config/deploy-bootstrap.txt` (comments or a few IDs) | Rare: pre-`deploy_enabled` on admin sync for greenfield forks. Production: use admin UI. |
| **Deploy order / priority** | `config/deploy-priority.txt` (one app ID per line) | Edit file; deploy.sh reads it and caps to `DEPLOY_MAX_APPS` from this order. |
| **Port assignment** | `KNOWN_PORTS` in db.ts for legacy; new apps get `getNextPort(db)` | At scale, new apps don’t need entries in KNOWN_PORTS. |
| **Env → app dir (admin)** | Derived from manifests: `env_prefix` or first segment of env key | New apps get correct `.env.local` write without editing PREFIX_TO_DIR in code. |
| **Caddyfile** | `scripts/generate-caddyfile.py` from manifests | Add app + manifest; regenerate Caddyfile. No per-app block editing. |
| **Compose app blocks** | Today: hand-written in docker-compose.yml | At scale: use `scripts/generate-compose.py` and `docker compose -f docker-compose.yml -f docker-compose.apps.yml`. |

## Adding an app at scale (no code edits)

1. Create `apps/<id>/` with `manifest.json` (and Dockerfile). Optionally set `env_prefix` in manifest if env vars don’t follow `<ID>_*`.
2. Add `<id>` to `config/deploy-priority.txt` if you want it in the deploy order.
3. Optionally add `<id>` to `config/deploy-bootstrap.txt` only for starter forks; otherwise use the admin deploy toggle.
4. Run `python3 scripts/generate-caddyfile.py`. If using generated compose, run `python3 scripts/generate-compose.py --output docker-compose.apps.yml`.
5. Deploy. Admin will discover the app from the filesystem and sync it; env vars from the manifest are seeded.

No edits to `deploy.sh`, `216labs_admin/src/lib/db.ts`, or `216labs_admin/src/app/actions.ts` are required.

## Agent concurrency and safety

- **Single deploy at a time** — Deploy touches the server and DB; run one deploy per branch/commit. For many agents, coordinate deploys (e.g. queue or single “deploy runner”) or deploy only from a single canonical branch.
- **App-scoped edits** — Prefer changes under `apps/<id>/` (and that app’s manifest). Reduces merge conflicts and keeps each agent’s blast radius small.
- **Shared config files** — `config/deploy-priority.txt` caps order; bootstrap is optional. Prefer manifest + admin DB over growing `deploy-bootstrap.txt`.
- **Discovery race** — Admin sync runs on startup and on `getAllApps()`. Multiple agents adding apps in parallel is fine; sync is idempotent. Env vars are `INSERT OR IGNORE` so duplicate keys from manifests are safe.

## Automated quality factory (no human ownership required)

At 1000+ apps, quality must be machine-enforced:

- **Changed-app gate (PR/push):** CI runs `scripts/quality-factory.py` with `--mode changed --checks manifest,compose,offline`.
  - Validates manifest structure.
  - Verifies each changed app exists in Compose config.
  - Builds and boots changed app containers offline, then probes HTTP readiness.
- **Live sweep (scheduled + sharded):** CI runs `--mode all --checks manifest,live` in shards, probing deployed subdomains for non-5xx responses and activator unknown-app failures.
- **Manifest-driven contracts:** each app can define optional `health_path` in `manifest.json` (default `/health`) so probes stay app-specific without custom code.

This model scales linearly by sharding and changed-app selection, while still continuously checking both offline and live quality.

## Optional: full generated compose at scale

When the number of app services makes hand-editing `docker-compose.yml` impractical:

1. Keep **base** compose: `docker-compose.yml` with only caddy, admin, anchor, happypath (and any other special-case services with volumes/custom config).
2. Generate app blocks:  
   `python3 scripts/generate-compose.py --apps $(cat enabled_app_ids.txt) --output docker-compose.apps.yml`  
   (or generate from DB on the server after pull.)
3. On the server:  
   `docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d`

Images are still built locally and transferred; the server does not build. The generator only emits `image:`, `environment`, `expose`, `mem_limit` (no `build:` or complex `volumes`). Apps that need custom volumes stay in the base compose or can be extended later via manifest (e.g. optional `volumes` in manifest).

## Manifest schema (reference)

- **id**, **name**, **tagline**, **description**, **category** — metadata.
- **internal_port**, **memory_limit**, **docker_service**, **build_context**, **build_dockerfile** — build/deploy.
- **env_prefix** (optional) — for admin env grouping (e.g. `ONEPAGE` for 1pageresearch).
- **env_vars** — list of `{ key, description, is_secret }`; keys are seeded into admin DB.
- **root_domain** (optional) — if true, Caddyfile generator assigns root domain to this app.
- **stack** — frontend/backend/database/other for display.

See `scripts/ADDING_AN_APP.md` for the day-to-day “add an app” flow.
