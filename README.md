# 216labs

Monorepo for 216labs web projects. All apps run on a single VPS via Docker Compose behind a Caddy reverse proxy with automatic HTTPS.

## Projects

| App | Stack | Subdomain |
|-----|-------|-----------|
| **RamblingRadio** | Express + React + Vite, PostgreSQL | `ramblingradio.{domain}` |
| **Stroll.live** | Express + React + Vite, SQLite | `stroll.{domain}` |
| **OneFit** | Next.js, SQLite | `onefit.{domain}` |
| **Paperframe** | Next.js frontend | `paperframe.{domain}` |
| **Paperframe ML** | FastAPI, SAM + BLIP (opt-in, needs 2GB+ RAM) | via `--profile ml` |

## Deploy to a droplet

### 1. Create a DigitalOcean droplet

- **$6/mo** (1 vCPU, 1GB RAM) works for the four lightweight apps
- **$24/mo** (4GB RAM) if you also want the Paperframe ML backend
- Choose the **Docker** image from the Marketplace, or any Ubuntu image

### 2. Point DNS

Add a wildcard A record for your domain:

```
*.216labs.com  →  <droplet IP>
```

### 3. Deploy

```bash
./deploy.sh root@<droplet-ip>
```

On first run this installs Docker (if needed), clones the repo, and creates a `.env` from the example. Edit `.env` on the droplet to set your domain and Postgres password, then run the script again:

```bash
./deploy.sh root@<droplet-ip>
```

That builds all images and starts everything. Caddy auto-provisions Let's Encrypt HTTPS.

### Subsequent deploys

Push to `main`, then:

```bash
./deploy.sh root@<droplet-ip>
```

### Enable the Paperframe ML backend

The SAM + BLIP backend is excluded by default (needs ~2GB RAM). To include it:

```bash
# On the droplet:
docker compose --profile ml up -d --build
```

Set `PAPERFRAME_API_URL=http://paperframe-backend:8000` in `.env` first.

## Local development

```bash
cp .env.example .env
# Set DOMAIN=localhost in .env
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
