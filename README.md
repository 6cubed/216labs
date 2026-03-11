# 216labs

**Enterprise-grade vibe coding workflow.** A monorepo factory that makes debugging and accountability tractable when building with AI: one source of truth (SQLite), a single pipeline dashboard, and explicit control over what ships. All apps run on a single VPS via Docker Compose behind Caddy with automatic HTTPS.

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
| **Múinteoir** | Next.js, SQLite, OpenAI | [muinteoir.agimemes.com](https://muinteoir.agimemes.com) |
| **Pocket** | Next.js, WebGPU, WebSocket relay | [pocket.agimemes.com](https://pocket.agimemes.com) |
| **StoryMagic** | Next.js, SQLite, OpenAI, Stripe | [storybook.agimemes.com](https://storybook.agimemes.com) |
| **216labs Admin** | Next.js (workflow & pipeline dashboard) | [admin.agimemes.com](https://admin.agimemes.com) |
| **Paperframe ML** | FastAPI, SAM + BLIP (opt-in, needs 2GB+ RAM) | via `--profile ml` |

## Deploy

Images are built locally on your dev machine and transferred to the droplet via SSH — no registry, no building on the server.

### One-time setup

1. **Create a DigitalOcean droplet** — $6/mo (1 vCPU, 1GB) is enough since it only runs containers, not builds. Choose the **Docker** marketplace image.

2. **Point DNS** — add a wildcard A record (already done on Namecheap):

```
*.agimemes.com  →  46.101.88.197
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
- Reads `216labs.db` to determine which apps are enabled (toggle via [admin.agimemes.com](https://admin.agimemes.com))
- Builds only enabled app images locally
- Skips transfer for images that haven't changed
- SSHs to the droplet, `git pull`s the latest config, and restarts the stack

### Enable the Paperframe ML backend

Excluded by default (needs ~2GB RAM). On a larger droplet, set `PAPERFRAME_API_URL=http://paperframe-backend:8000` in the admin env vars, then:

```bash
# On the droplet:
docker compose --profile ml up -d
```

## Local development

```bash
cp .env.example .env
# Set APP_HOST=localhost (HTTP only, no certs)
docker compose up --build
```

To run a single app without Docker, `cd` into its directory and follow its own README.

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
