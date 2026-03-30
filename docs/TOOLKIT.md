# Client-agnostic toolkit

This monorepo is both a **production host** for many apps and a **reusable pattern**: one SQLite source of truth, one admin surface, one deploy script, Caddy + optional activator cold-starts, and `manifest.json` beside each app.

## Demo apps

Under `products/org-platform/toolkit-demos/`:

| Directory       | Stack              | Purpose                                      |
|----------------|--------------------|----------------------------------------------|
| `hello-nextjs` | Next.js standalone | Minimal App Router service + Docker build   |
| `hello-flask`  | Flask + Gunicorn   | Minimal Python service + same routing model  |

They exist to prove the pipeline on a fresh machine. You can delete them once your own apps replace them, or keep them as regression checks.

## Fresh clone: small local stack

1. Copy env: `cp .env.example .env` and set `APP_HOST=localhost` (HTTP only for local Caddy; adjust as needed).
2. Ensure `216labs.db` exists or let the **admin** container create it on first start (empty file is enough: `touch 216labs.db`).
3. Regenerate the proxy config after adding or removing apps: `python3 scripts/generate-caddyfile.py`
4. Bring up a **small** set of services (example):

   ```bash
   docker compose up -d caddy activator admin landing hello-nextjs hello-flask
   ```

5. Open the admin UI and enable/disable apps as needed. Optional `config/deploy-bootstrap.txt` can pre-enable a few IDs on admin sync (leave empty in production; use toggles + CI).

Deploy without a local DB (e.g. CI) uses `config/toolkit-default-enabled.txt` — edit that file to change the default app set for no-DB runs.

## Greenfield / community starter (next step)

A follow-up workflow is: **fork or clone**, then **remove portfolio apps** you do not need, keep `internal/`, `scripts/`, `config/`, and the toolkit demos (or replace them), and publish as a separate repository for others to start from.

To approximate a **minimal deploy surface** before that split:

- Copy the example configs (see `config/examples/toolkit-starter/README.md`) over `config/deploy-priority.txt` (and optionally a minimal `deploy-bootstrap.txt`), then trim `docker-compose.yml` or rely on admin toggles + GHCR.

- Point `deploy.sh` at **your** Git remote and server checkout path without editing the script: `DEPLOY_REPO` and `DEPLOY_APP_DIR` (defaults remain `git@github.com:6cubed/216labs.git` and `/opt/216labs`).

- Replace branding strings in `README.md` and manifests with your org name; keep the **mechanics** (manifests, deploy, admin) unchanged.

## Shared Python (HTTP)

`internal/python/labs_http/` holds stdlib-only helpers (`fetch_json`, `http_probe`, `normalize_blog_items`) with consistent timeouts and error handling. Images that import it use a **repo-root** Docker build (`build.context: .` plus a `dockerfile` path under `products/…`) and `COPY internal/python/labs_http /app/labs_http`.

## Related scripts

- `./scripts/new-app.sh <id> [nextjs|flask|fastapi]` — scaffold another app under `products/org-platform/local/`.
- `./scripts/init-toolkit-starter-config.sh` — optional; copies starter `deploy-*.txt` examples (see `config/examples/toolkit-starter/`).
