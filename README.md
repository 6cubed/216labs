# 216labs

Monorepo for 216labs web projects. All apps run on a single VPS via Docker Compose behind a Caddy reverse proxy with automatic HTTPS.

## Projects

| App | Stack | Subdomain |
|-----|-------|-----------|
| **RamblingRadio** | Express + React + Vite, PostgreSQL | `ramblingradio.{domain}` |
| **Stroll.live** | Express + React + Vite, SQLite | `stroll.{domain}` |
| **OneFit** | Next.js, SQLite | `onefit.{domain}` |
| **Paperframe** | Next.js frontend | `paperframe.{domain}` |
| **HiveFind** | Next.js | `hivefind.{domain}` |
| **PipeSecure** | Next.js, PostgreSQL, Redis, BullMQ | `pipesecure.{domain}` |
| **216labs Admin** | Next.js (pipeline dashboard) | `admin.{domain}` |
| **Paperframe ML** | FastAPI, SAM + BLIP (opt-in, needs 2GB+ RAM) | via `--profile ml` |

## Deploy to a droplet

Images are built locally on your dev machine and pushed to GitHub Container Registry. The droplet only pulls and runs pre-built images — no building on the server.

### One-time setup

1. **Create a DigitalOcean droplet** — $6/mo (1 vCPU, 1GB) is enough since it only runs containers, not builds. Choose the **Docker** marketplace image.

2. **Point DNS** — add a wildcard A record:

```
*.216labs.com  →  <droplet IP>
```

3. **Log in to GHCR locally** (once):

```bash
echo <your-github-pat> | docker login ghcr.io -u 6cubed --password-stdin
```

### Deploy

```bash
./deploy.sh root@<droplet-ip>
```

This builds all images on your machine, pushes them to `ghcr.io/6cubed/216labs/*`, then SSHs to the droplet to pull and start them. On first run it creates a `.env` — edit it on the droplet to set your domain and Postgres password, then re-run.

### Subsequent deploys

```bash
./deploy.sh root@<droplet-ip>
```

Only changed layers are pushed/pulled, so re-deploys are fast.

### Enable the Paperframe ML backend

Excluded by default (needs ~2GB RAM). On a larger droplet:

```bash
# On the droplet:
docker compose --profile ml pull
docker compose --profile ml up -d
```

Set `PAPERFRAME_API_URL=http://paperframe-backend:8000` in `.env` first.

## Local development

```bash
cp .env.example .env
# Set DOMAIN=localhost
docker compose up --build
```

Apps are available at `ramblingradio.localhost`, `stroll.localhost`, etc.

Or run any project individually without Docker:

```bash
cd RamblingRadio && npm install && npm run dev
cd Stroll.live && npm install && npm run dev
cd onefit && npm install && npm run dev
```

## Architecture

```
                     ┌──────────────────────┐
                     │   DNS: *.domain.com  │
                     └──────────┬───────────┘
                                │
                     ┌──────────▼───────────┐
                     │   Caddy :80/:443     │
                     │   (auto HTTPS)       │
                     └──┬────┬────┬────┬────┘
                        │    │    │    │
         ┌──────────────┘    │    │    └──────────────┐
         ▼                   ▼    ▼                   ▼
   ┌───────────┐     ┌──────┐  ┌──────┐    ┌──────────────┐
   │ Rambling  │     │Stroll│  │OneFit│    │  Paperframe  │
   │  Radio    │     │ .live│  │      │    │   frontend   │
   │  :5000    │     │:5000 │  │:3000 │    │    :3000     │
   └─────┬─────┘     └──────┘  └──────┘    └──────────────┘
         │
   ┌─────▼─────┐
   │ Postgres  │
   │  :5432    │
   └───────────┘
```

## Cost

| Setup | Monthly |
|-------|---------|
| DO App Platform (5 services + managed DB) | ~$32+ |
| **Single droplet (this setup)** | **$6-12** |
