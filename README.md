# 216labs

**Enterprise-grade vibe coding workflow.** A monorepo factory that makes debugging and accountability tractable when building with AI: one source of truth (SQLite), a single pipeline dashboard, and explicit control over what ships. All apps run on a single VPS via Docker Compose behind Caddy with automatic HTTPS.

## Layout

- **`products/`** — Customer-facing products grouped by **org** and **vertical** (for example `org-shopping`, `org-growth/ads`, `org-media`, `org-platform/ai`). New scaffolds default to `products/org-platform/local/<id>` via `./scripts/new-app.sh <app-id>`.
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
| **216labs Admin** | Next.js (workflow & pipeline dashboard) | [admin.6cubed.app](https://admin.6cubed.app) |

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

**Prerequisites**

- **Python 3.10+** (macOS: `python3 --version`; install from [python.org](https://www.python.org/downloads/) or Homebrew if needed).
- **Cursor** installed at `/Applications/Cursor.app` (default install).
- A **Telegram bot** token from [@BotFather](https://t.me/BotFather).

**1. Clone and open the repo**

```bash
git clone git@github.com:6cubed/216labs.git
cd 216labs
```

**2. Start the bridge (first run)**

From the repo root:

```bash
./scripts/ensure-and-start-pocket-cursor.sh
```

The first run will:

- Create `internal/admin/pocket-cursor-bridge/.venv` and install `requirements.txt`.
- Copy `internal/admin/pocket-cursor-bridge/.env.example` to `.env` and **exit** so you can edit secrets.

Edit `internal/admin/pocket-cursor-bridge/.env` and set at least **`TELEGRAM_BOT_TOKEN`**. Optionally set **`OPENAI_API_KEY`** for voice-to-text from Telegram.

**3. Launch Cursor with Chrome DevTools Protocol (CDP)**

The bridge talks to Cursor over CDP. If Cursor was started from the Dock without debugging flags, **close Cursor**, then from a terminal:

```bash
cd internal/admin/pocket-cursor-bridge
source .venv/bin/activate
python start_cursor.py
```

That starts (or reuses) Cursor with CDP on port **9222** (or the next free port). Use `python start_cursor.py --check` to verify CDP is up without launching a new window.

**4. Run the bridge again**

With `.env` filled in and Cursor running with CDP:

```bash
./scripts/ensure-and-start-pocket-cursor.sh
```

Leave that terminal open; the bridge runs until you stop it (Ctrl+C). To restart later, run the same script (it stops any existing `pocket_cursor.py` process first).

**Optional**

- **Phone outbox images** (Markdown → styled PNG for Telegram): in `internal/admin/pocket-cursor-bridge/`, run `npm install` so `md_to_image.mjs` can use Puppeteer (see `.env.example` for `RENDER_LOCAL_DIR` if the repo is on slow storage).
- **Windows** dev machines: use `internal/admin/pocket-cursor-bridge/restart_pocket_cursor.py` (kill + start in one step) instead of the shell script.

The **Flask + Telegram** service on the VPS (`pocketcursor` in `docker-compose.yml`) is separate; it is for group policy and a small admin UI at `pocketcursor.6cubed.app`, not a substitute for your local `pocket_cursor.py`.

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
