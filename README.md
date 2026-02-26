# 216labs

Monorepo for 216labs web projects. All apps run on a single VPS via Docker Compose behind a Caddy reverse proxy with automatic HTTPS.

## Projects

| App | Stack | URL |
|-----|-------|-----|
| **RamblingRadio** | Express + React + Vite, PostgreSQL | [ramblingradio.agimemes.com](https://ramblingradio.agimemes.com) |
| **Stroll.live** | Express + React + Vite, SQLite | [stroll.agimemes.com](https://stroll.agimemes.com) |
| **OneFit** | Next.js, SQLite | [onefit.agimemes.com](https://onefit.agimemes.com) |
| **Paperframe** | Next.js frontend | [paperframe.agimemes.com](https://paperframe.agimemes.com) |
| **HiveFind** | Next.js | [hivefind.agimemes.com](https://hivefind.agimemes.com) |
| **PipeSecure** | Next.js, PostgreSQL, Redis, BullMQ | [pipesecure.agimemes.com](https://pipesecure.agimemes.com) |
| **AGI Memes** | Flask | [agimemes.agimemes.com](https://agimemes.agimemes.com) |
| **AgitShirts** | Flask, daily AI generation | [agitshirts.agimemes.com](https://agitshirts.agimemes.com) |
| **Priors** | Flask, Google OAuth, Gemini | [priors.agimemes.com](https://priors.agimemes.com) |
| **CalibratedAI** | Next.js, SQLite | [calibratedai.agimemes.com](https://calibratedai.agimemes.com) |
| **Big Leroy's** | Flask, Google OAuth, SQLite | [bigleroys.agimemes.com](https://bigleroys.agimemes.com) |
| **Anchor** | FastAPI + React | [anchor.agimemes.com](https://anchor.agimemes.com) |
| **1PageResearch** | Flask, SQLite | [1pageresearch.agimemes.com](https://1pageresearch.agimemes.com) |
| **Artisanal Europe** | Next.js | [artisinaleurope.agimemes.com](https://artisinaleurope.agimemes.com) |
| **Zurich Dating Game** | Next.js, SQLite | [thezurichdatinggame.agimemes.com](https://thezurichdatinggame.agimemes.com) |
| **OneRoom** | Next.js | [oneroom.agimemes.com](https://oneroom.agimemes.com) |
| **Audio AI Checkup** | Next.js, SQLite | [audioaicheckup.agimemes.com](https://audioaicheckup.agimemes.com) |
| **216labs Admin** | Next.js (pipeline dashboard) | [admin.agimemes.com](https://admin.agimemes.com) |
| **Paperframe ML** | FastAPI, SAM + BLIP (opt-in, needs 2GB+ RAM) | via `--profile ml` |

## Deploy to a droplet

Images are built locally on your dev machine and transferred to the droplet via SSH — no registry, no building on the server.

### One-time setup

1. **Create a DigitalOcean droplet** — $6/mo (1 vCPU, 1GB) is enough since it only runs containers, not builds. Choose the **Docker** marketplace image.

2. **Point DNS** — add a wildcard A record (already done on Namecheap):

```
*.agimemes.com  →  46.101.88.197
```

3. **Clone and configure** — on first deploy the script creates `.env` from `.env.example`. SSH in and fill in secrets, then re-deploy.

### Deploy

```bash
./deploy.sh root@46.101.88.197
```

The script:
- Reads `216labs.db` to determine which apps are enabled (toggle via [admin.agimemes.com](https://admin.agimemes.com))
- Builds only enabled app images locally
- Skips transfer for images that haven't changed
- SSHs to the droplet, `git pull`s the latest config, and restarts the stack

### First deploy

On first run the remote `.env` is created from `.env.example`. SSH in to fill in secrets, then re-run:

```bash
ssh root@46.101.88.197 "nano /opt/216labs/.env"
./deploy.sh root@46.101.88.197
```

### Enable the Paperframe ML backend

Excluded by default (needs ~2GB RAM). On a larger droplet:

```bash
# On the droplet:
docker compose --profile ml up -d
```

Set `PAPERFRAME_API_URL=http://paperframe-backend:8000` in the admin env vars first.

## Local development

```bash
cp .env.example .env
# Set APP_HOST=localhost (HTTP only, no certs)
docker compose up --build
```

Or run any project individually without Docker:

```bash
cd RamblingRadio && npm install && npm run dev
cd Stroll.live && npm install && npm run dev
cd onefit && npm install && npm run dev
```

## Architecture

```
                  ┌─────────────────────────┐
                  │   DNS: *.agimemes.com   │
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
   │ramblingradio│  │stroll│     │ admin │  │audioaicheckup│
   │   :5000    │  │:5000 │     │ :3000 │  │    :3000     │
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
