# 216Labs

**At 216Labs we are building the toolkit for production grade vibes.** In practice: a monorepo factory that makes debugging and accountability tractable when building with AI — one source of truth (SQLite), a single pipeline dashboard, and explicit control over what ships. All apps run on a single VPS via Docker Compose behind Caddy with automatic HTTPS.

## Toolkit vs portfolio

The repo is designed to stay **client-agnostic**: manifests, one admin DB, one deploy path, Caddy, and optional activator cold-starts. **`products/org-platform/toolkit-demos/`** holds tiny **hello-world** apps (Next.js + Flask) that demonstrate that pipeline on a fresh install. A larger set of apps under `products/` is the live portfolio; you can trim or fork for your own stack. See **`docs/TOOLKIT.md`** for greenfield setup, `config/toolkit-default-enabled.txt` for no-DB deploy defaults, and **`config/examples/toolkit-starter/`** for minimal deploy config you can copy when publishing a community starter repo.

## Layout

- **`products/`** — Customer-facing products grouped by **org** and **vertical** (for example `org-shopping`, `org-growth/ads`, `org-media`, `org-platform/ai`). New scaffolds default to `products/org-platform/local/<id>` via `./scripts/new-app.sh <app-id>`. Reference demos live in **`products/org-platform/toolkit-demos/`**.
- **`internal/`** — Internal-only services: **admin** (workflow dashboard), **quality/happypath** (clickthrough tests), **security/pipesecure** (security pipeline), **ops/cron-runner**, **platform/activator**, and similar.
- **`packages/`** — Reserved for shared libraries and design-system style code reused across products (empty until extracted).
- **`config/`** — Deploy caps, bootstrap lists, and other repo-level configuration.

## Projects

| App | Stack | URL |
|-----|-------|-----|
| **RamblingRadio** | Express + React + Vite, PostgreSQL | [ramblingradio.6cubed.app](https://ramblingradio.6cubed.app) |
| **Stroll.live** | Express + React + Vite, SQLite | [stroll.6cubed.app](https://stroll.6cubed.app) |
| **OneFit** | Next.js, SQLite | [onefit.6cubed.app](https://onefit.6cubed.app) |
| **HiveFind** | Next.js | [hivefind.6cubed.app](https://hivefind.6cubed.app) |
| **PipeSecure** | Next.js, PostgreSQL, Redis, BullMQ | [pipesecure.6cubed.app](https://pipesecure.6cubed.app) |
| **AGI Memes** | Flask | [agimemes.6cubed.app](https://agimemes.6cubed.app) |
| **AgitShirts** | Flask, daily AI generation | [agitshirts.6cubed.app](https://agitshirts.6cubed.app) |
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
| **216Labs Admin** | Next.js (workflow & pipeline dashboard) | [admin.6cubed.app](https://admin.6cubed.app) |

## Deploy

Images are built locally on your dev machine and transferred to the droplet via SSH — no registry, no building on the server.

### One-time setup

1. **Create a DigitalOcean droplet** — $6/mo (1 vCPU, 1GB) is enough since it only runs containers, not builds. Choose the **Docker** marketplace image.

2. **Point DNS** — add a wildcard A record (already done on Namecheap):

```
*.6cubed.app  →  46.101.88.197
```

3. **Configure secrets** — on first deploy the script creates `.env` from `.env.example` on the droplet. SSH in, fill in secrets, then re-deploy:

```bash
ssh root@46.101.88.197 "nano /opt/216labs/.env"
./deploy.sh root@46.101.88.197
```

### Deploy

```bash
./deploy.sh root@46.101.88.197
```

The script:
- Reads `216labs.db` to determine which apps are enabled (toggle via [admin.6cubed.app](https://admin.6cubed.app))
- Builds only enabled app images locally
- Skips transfer for images that haven't changed
- SSHs to the droplet, `git pull`s the latest config, and restarts the stack

### Telegram cron jobs

The **cron-runner** service runs scheduled jobs (daily digest, Happy Path summary, etc.) and posts to a Telegram chat. Enable jobs in the admin under **Cron**. Set **TELEGRAM_BOT_TOKEN** and **TELEGRAM_CHAT_ID** in the admin **Env** so the runner can send messages (deploy loads these into the cron-runner container).

## Local development

```bash
cp .env.example .env
# Set APP_HOST=localhost (HTTP only, no certs)
docker compose up --build
```

To run a single app without Docker, `cd` into its directory and follow its own README.

### PocketCursor bridge (Telegram ↔ Cursor on your Mac)

The **local** bridge lives at `internal/admin/pocket-cursor-bridge/`. It mirrors Cursor’s chat with Telegram on your phone; it does **not** run the whole monorepo in Docker.

**Prerequisites:** **Python 3.10+** (many Macs still default to `python3` **3.7** — run `python3 --version`; if needed install `brew install python@3.12` and use it, or set `POCKETCURSOR_PYTHON` to that binary). Cursor at `/Applications/Cursor.app`, and a Telegram bot token from [@BotFather](https://t.me/BotFather).

**One command** from the repo root (after `git clone` and `cd 216labs`):

```bash
./scripts/pocket-cursor-bridge.sh
```

The **first** run creates `.venv`, installs only the bridge dependencies (no Flask), copies `.env.example` → `internal/admin/pocket-cursor-bridge/.env`, and exits — set **`TELEGRAM_BOT_TOKEN`** there, then run the same script again.

On the **second** run it starts Cursor with CDP (via `start_cursor.py`) and then runs `pocket_cursor.py` (leave the terminal open; Ctrl+C to stop). Optional: **`OPENAI_API_KEY`** in `.env` for voice-to-text.

**Phone outbox** (Markdown → PNG): in `internal/admin/pocket-cursor-bridge/`, run `npm install` for Puppeteer. **Windows:** use `restart_pocket_cursor.py` in that folder instead of bash.

The **Flask** service on the VPS (`pocketcursor` in `docker-compose.yml`) is separate; it is for group policy and `pocketcursor.6cubed.app`, not a substitute for local `pocket_cursor.py`.

## Architecture

```
                  ┌─────────────────────────┐
                  │   DNS: *.6cubed.app   │
                  │   → 46.101.88.197       │
                  └───────────┬─────────────┘
                              │
                  ┌───────────▼─────────────┐
                  │   Caddy :80 / :443      │
                  │   (auto HTTPS via ACME) │
                  └──┬──┬──┬──┬──┬──┬──┬───┘
                     │  │  │  │  │  │  │
          ┌──────────┘  │  │  │  │  │  └────────────┐
          ▼             ▼  ▼  ▼  ▼  ▼               ▼
   ┌────────────┐  ┌──────┐ ... ┌───────┐  ┌──────────────┐
   │ramblingradio│  │stroll│     │ admin │  │  (20+ apps)  │
   │   :5000    │  │:5001 │     │ :3000 │  │  :3000 each  │
   └──────┬─────┘  └──────┘     └───────┘  └──────────────┘
          │
   ┌──────▼─────┐   ┌───────────┐   ┌──────────────────┐
   │ PostgreSQL │   │  Redis    │   │ SQLite (embedded) │
   │   :5432    │   │  :6379    │   │  (per-app files)  │
   └────────────┘   └───────────┘   └──────────────────┘
```

## Cost

| Setup | Monthly |
|-------|---------|
| DO App Platform (5 services + managed DB) | ~$32+ |
| **Single droplet (this setup)** | **$6-12** |
