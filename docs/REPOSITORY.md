# Repository handbook

Long-form reference for layout, deploy, and day-two ops. The root [`README.md`](../README.md) stays minimal on purpose.

## Design

The layout stays **client-agnostic**: manifests, one admin DB, one deploy path, Caddy, optional activator cold-starts. **`products/org-platform/toolkit-demos/`** holds minimal hello-world apps (Next.js + Flask) that exercise the pipeline on a fresh install. Add your own apps under **`products/`** (or trim what ships by default). See **`docs/TOOLKIT.md`**, **`config/toolkit-default-enabled.txt`**, and **`config/examples/toolkit-starter/`** for greenfield and starter publishing.

## Layout

| Path | Role |
|------|------|
| **`products/`** | Customer-facing apps by **org** and vertical (`org-shopping`, `org-growth/ads`, `org-media`, `org-platform/ai`, …). New scaffolds default to `products/org-platform/local/<id>` via `./scripts/new-app.sh <app-id>`. Reference demos: **`products/org-platform/toolkit-demos/`**. |
| **`internal/`** | Admin dashboard, quality (e.g. happypath), security (pipesecure), ops (cron-runner), platform (activator), etc. |
| **`packages/`** | Shared libraries / design-system-style code (reserved; empty until extracted). |
| **`config/`** | Deploy caps, bootstrap snippets, priority order, repo-level configuration. |

### Public writing: Tigertank vs 216Labs blog

Two Next.js publications serve different audiences. **Do not** put think-tank / policy / societal speculation essays in the factory blog.

| Surface | URL | Purpose | Posts live in repo |
|--------|-----|---------|---------------------|
| **Tigertank** | [tigertank.6cubed.app](https://tigertank.6cubed.app) | Speculative “think tank” essays (policy, governance, fiscal ideas, housing, systems) | `products/org-lifestyle/play/tigertank/src/lib/posts.ts` — routes **`/`** and **`/read/[slug]`** (legacy **`/p/:slug`** redirects to **`/read/:slug`**) |
| **216Labs blog** | [blog.6cubed.app](https://blog.6cubed.app) | Monorepo / factory essays: deploy, hosting, security, roadmap, vibe-coding practice | `products/org-media/blog/src/lib/posts.ts` — routes **`/`** and **`/blog/[slug]`** |

Caddy routes both like any other enabled app (`manifest.json` → `tigertank` / `blog`). When adding a long-form essay, pick the column first; duplicate publishing the same piece in both places is discouraged.

## Projects (public URLs)

Stacks are indicative; trust each app’s `manifest.json` and Dockerfile for truth.

| App | Stack (short) | URL |
|-----|----------------|-----|
| **RamblingRadio** | Express + React + Vite, PostgreSQL | [ramblingradio.6cubed.app](https://ramblingradio.6cubed.app) |
| **Stroll.live** | Express + React + Vite, SQLite | [stroll.6cubed.app](https://stroll.6cubed.app) |
| **OneFit** | Next.js, SQLite | [onefit.6cubed.app](https://onefit.6cubed.app) |
| **HiveFind** | Next.js | [hivefind.6cubed.app](https://hivefind.6cubed.app) |
| **PipeSecure** | Node (security scanner; single or multi-repo via `PIPESECURE_GITHUB_REPOS`) | [pipesecure.6cubed.app](https://pipesecure.6cubed.app) |
| **AGI Memes** | Flask | [agimemes.6cubed.app](https://agimemes.6cubed.app) |
| **AgitShirts** | Flask | [agitshirts.6cubed.app](https://agitshirts.6cubed.app) |
| **Priors** | Flask, Google OAuth, Gemini | [priors.6cubed.app](https://priors.6cubed.app) |
| **CalibratedAI** | Next.js, SQLite | [calibratedai.6cubed.app](https://calibratedai.6cubed.app) |
| **Big Leroy's** | Flask, Google OAuth, SQLite | [bigleroys.6cubed.app](https://bigleroys.6cubed.app) |
| **Anchor** | FastAPI + React | [anchor.6cubed.app](https://anchor.6cubed.app) |
| **1PageResearch** | Flask, SQLite | [1pageresearch.6cubed.app](https://1pageresearch.6cubed.app) |
| **Artisanal Europe** | Next.js | [artisinaleurope.6cubed.app](https://artisinaleurope.6cubed.app) |
| **Zurich Dating Game** | Next.js, SQLite | [thezurichdatinggame.6cubed.app](https://thezurichdatinggame.6cubed.app) |
| **OneRoom** | Next.js | [oneroom.6cubed.app](https://oneroom.6cubed.app) |
| **Audio AI Checkup** | Next.js, SQLite | [audioaicheckup.6cubed.app](https://audioaicheckup.6cubed.app) |
| **Múinteoir** | Next.js, SQLite, OpenAI | [muinteoir.6cubed.app](https://muinteoir.6cubed.app) |
| **Pocket** | Next.js, WebGPU, WebSocket relay | [pocket.6cubed.app](https://pocket.6cubed.app) |
| **StoryMagic** | Next.js, SQLite, OpenAI, Stripe | [storybook.6cubed.app](https://storybook.6cubed.app) |
| **216Labs Admin** | Next.js (workflow & pipeline) | [admin.6cubed.app](https://admin.6cubed.app) |
| **216Labs blog** | Next.js (factory & toolkit essays) | [blog.6cubed.app](https://blog.6cubed.app) |
| **Tigertank** | Next.js (speculative policy & society essays) | [tigertank.6cubed.app](https://tigertank.6cubed.app) |

## Deploy

**Images:** GitHub Actions builds and pushes `216labs/*` to **GHCR** on pushes to `main` (see `.github/workflows/ghcr-publish.yml`).

**VPS:** From the repo root, `./deploy.sh root@46.101.88.197` (or your host) pulls/retags images and brings Compose up. Enabled apps are driven by **`216labs.db`** (toggles in [admin](https://admin.6cubed.app)). Legacy `DEPLOY_IMAGE_SOURCE=local` builds on the machine running the script and streams images over SSH—use only when GHCR is not an option. Do not build images on the droplet (resource-limited).

### One-time droplet setup

1. **Droplet** — e.g. Docker marketplace image; small instance is fine (containers only, no builds).
2. **DNS** — wildcard `*.6cubed.app` → your server IP (example: `46.101.88.197`).
3. **Secrets** — `.env` / `.env.admin` on the host (see `.env.example`); fill secrets, then deploy. **`GHCR_TOKEN`** is only needed if GHCR images are **private**; public packages pull anonymously.

### Telegram cron jobs

**cron-runner** runs scheduled jobs from the admin **Cron** UI. Set **`TELEGRAM_BOT_TOKEN`** and **`TELEGRAM_CHAT_ID`** in admin **Env** (persisted in **`216labs.db`**). On deploy, **`deploy.sh`** writes **`env_vars`** into **`.env.admin`** via the admin container when it is running, or via **`scripts/export-env-admin-from-db.py`** when admin is not — so **`docker compose`** still passes **`TELEGRAM_*`** into **cron-runner** from the DB. Optional droplet-only **`ADMIN_DEFAULT_TELEGRAM_LOGGING_CHAT_ID`** / **`ADMIN_DEFAULT_TELEGRAM_BOT_TOKEN`** seed empty DB rows on admin startup. To verify what cron-runner resolves without exposing tokens, **`GET http://cron-runner:3029/telegram-env`** (same **Bearer** as **Run now** when **`CRON_RUNNER_SECRET`** is set).

**Workforce (`workforce-telegram-test`):** **`TELEGRAM_BOT_TOKEN`** and chat id are read from **`env_vars`** in **`216labs.db`** when the container env is empty (same as other crons). Chat resolution order is **`WORKFORCE_TELEGRAM_CHAT_ID`** then **`TELEGRAM_CHAT_ID`** (handler override, then shared send path). The handler no longer bails out before send when the chat id exists only in **`env_vars`**. The job is **enabled by default**; it posts hourly using the first digital employee’s bot token from **`internal/admin/workforce/data/workforce-employees.json`**, or the **main bot** with a setup hint if the registry is missing or empty. Messages from a configured employee appear **as that employee’s bot**, not the main logging bot, until you add a token or remove it from the registry entry.

### Edge traffic (unique visitors per app)

Caddy writes a **shared JSON access log** to the **`caddy_access_logs`** Docker volume (`/var/log/caddy/access.log` in the **caddy** and **cron-runner** containers). The **`edge-visitor-rollup`** cron job (default **on**, every **15 minutes**) appends coarse daily rows into **`216labs.db`** table **`edge_visitor_day`** (`app_id`, `day_utc`, `visitor_hash` where `visitor_hash` is derived from client IP + `User-Agent`). This is **not** GA4-level identity; it is an **edge approximation** for ops and automation.

Query example (rolling **7** days, app id = manifest id, e.g. `onefit`):

```bash
./scripts/query_edge_uniques.sh onefit 7
```

On the droplet, point **`EDGE_UNIQUES_DB`** at the host’s `216labs.db` if you run the script from another directory.

## Local development

```bash
cp .env.example .env
# APP_HOST=localhost for HTTP-only local (no certs)
docker compose up --build
```

Single-app development without Docker: `cd` into the product and follow its own README.

## PocketCursor bridge (Telegram ↔ Cursor)

The bridge under **`internal/admin/pocket-cursor-bridge/`** syncs Cursor chat with Telegram on your machine; it does not run the whole monorepo in Docker. Entry point: **`./scripts/pocket-cursor-bridge.sh`**. Full notes: **`.cursor/rules/pocket-cursor.mdc`**, **`docs/POCKET_CURSOR.md`**.

## Architecture (high level)

```
                  ┌─────────────────────────┐
                  │   DNS: *.6cubed.app     │
                  └───────────┬─────────────┘
                              │
                  ┌───────────▼─────────────┐
                  │   Caddy :80 / :443      │
                  │   (HTTPS via ACME)      │
                  └──┬──┬──┬──┬──┬──┬──┬───┘
                     │  │  │  │  │  │  │
          ┌──────────┘  │  │  │  │  │  └────────────┐
          ▼             ▼  ▼  ▼  ▼  ▼               ▼
   ┌────────────┐  ┌──────┐     ┌───────┐  ┌──────────────┐
   │ app :port │  │ app  │ ... │ admin │  │  more apps   │
   └──────┬─────┘  └──────┘     └───────┘  └──────────────┘
          │
   ┌──────▼─────┐   ┌───────────┐   ┌──────────────────┐
   │ PostgreSQL │   │  Redis    │   │ SQLite (216labs) │
   │  (where    │   │ (where    │   │ + per-app files  │
   │   used)    │   │  used)    │   └──────────────────┘
   └────────────┘   └───────────┘
```

## Cost (rough)

| Setup | Monthly (order of magnitude) |
|-------|-------------------------------|
| Managed PaaS + DBs for many services | $30+ |
| **Single droplet (this pattern)** | **~$6–12** |

## See also

- **`docs/SCALING.md`** — showroom, hot pools, activator caps  
- **`docs/DROPLET_SYNC.md`** — periodic GHCR sync on the droplet  
- **`docs/PROJECT_IDEAS.md`** — backlog / ideas
