# 216labs

Monorepo for 216labs web projects. Each project runs as its own Docker service, orchestrated via Docker Compose with a Caddy reverse proxy.

## Projects

| App | Stack | Internal Port | Subdomain |
|-----|-------|---------------|-----------|
| **RamblingRadio** | Express + React + Vite, PostgreSQL | 5000 | `ramblingradio.{domain}` |
| **Stroll.live** | Express + React + Vite, SQLite | 5000 | `stroll.{domain}` |
| **OneFit** | Next.js, SQLite | 3000 | `onefit.{domain}` |
| **Paperframe** | Next.js (frontend) + FastAPI (backend), SAM + BLIP | 3000 / 8000 | `paperframe.{domain}` |

## Quick Start (Docker Compose)

```bash
cp .env.example .env
# Edit .env with your database credentials and domain

docker compose up --build
```

This starts all services behind a Caddy reverse proxy on ports 80/443.

### Local development (port-based, no DNS)

If you don't have subdomains set up, edit the `Caddyfile` to uncomment the port-based routing block at the bottom and comment out the subdomain blocks. This gives you:

| App | URL |
|-----|-----|
| RamblingRadio | http://localhost:8001 |
| Stroll.live | http://localhost:8002 |
| OneFit | http://localhost:8003 |
| Paperframe | http://localhost:8004 |

### Run a single service

```bash
docker compose up --build ramblingradio postgres
docker compose up --build stroll
docker compose up --build onefit
docker compose up --build paperframe-frontend paperframe-backend
```

## Deploy to DigitalOcean App Platform

An app spec is provided at `.do/app.yaml`. Deploy with:

```bash
doctl apps create --spec .do/app.yaml
```

Each service is built from its Dockerfile and routed to its own subdomain via DO's built-in routing. Pushes to `main` trigger automatic deploys.

To update an existing app:

```bash
doctl apps update <app-id> --spec .do/app.yaml
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Caddy (80/443)                    │
│  ramblingradio.*  stroll.*  onefit.*  paperframe.*  │
└──────┬──────────────┬─────────┬──────────┬──────────┘
       │              │         │          │
  ┌────▼────┐   ┌─────▼───┐ ┌──▼───┐ ┌───▼────────────┐
  │Rambling │   │ Stroll  │ │OneFit│ │  Paperframe    │
  │ Radio   │   │  .live  │ │      │ │ FE ──── BE     │
  │ :5000   │   │ :5000   │ │:3000 │ │:3000    :8000  │
  └────┬────┘   └─────────┘ └──────┘ └────────────────┘
       │
  ┌────▼────┐
  │Postgres │
  │ :5432   │
  └─────────┘
```
