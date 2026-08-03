# Client-agnostic toolkit

This monorepo is both a **production host** for many apps and a **reusable pattern**: one SQLite source of truth, one admin surface, one deploy script, Caddy + optional activator cold-starts, and `manifest.json` beside each app.

## Plug and play (local)

One command from a clone (Docker required):

```bash
./scripts/bootstrap-toolkit.sh
```

That script:

1. Writes **`.env.toolkit`** (does not overwrite a production `.env`)
2. Creates an admin basic-auth password (printed + saved in **`.toolkit-admin-credentials`**)
3. Generates **`Caddyfile.local`** — HTTP only, demo allowlist (so Activator will not cold-start the whole portfolio)
4. Builds and starts: `caddy`, `activator`, `admin`, `landing`, `hello-nextjs`, `hello-flask`
5. Smoke-checks the local URLs

| URL | What |
|-----|------|
| http://localhost/ | Landing |
| http://admin.localhost/ | Admin (basic auth) |
| http://hello-nextjs.localhost/ | Next.js demo |
| http://hello-flask.localhost/ | Flask demo |

`*.localhost` resolves to `127.0.0.1` on modern macOS/Linux — no `/etc/hosts` edit.

Options:

```bash
./scripts/bootstrap-toolkit.sh --no-up           # prepare files only
./scripts/bootstrap-toolkit.sh --starter-config  # also copy config/examples/toolkit-starter/*
```

Add your own app: `./scripts/new-app.sh myapp nextjs` (then wire compose + regenerate Caddy — see `scripts/ADDING_AN_APP.md`).

## Demo apps

Under `products/org-platform/toolkit-demos/`:

| Directory       | Stack              | Purpose                                      |
|----------------|--------------------|----------------------------------------------|
| `hello-nextjs` | Next.js standalone | Minimal App Router service + Docker build   |
| `hello-flask`  | Flask + Gunicorn   | Minimal Python service + same routing model  |

They exist to prove the pipeline on a fresh machine. You can delete them once your own apps replace them, or keep them as regression checks.

## Manual local steps (same as bootstrap)

If you prefer not to use the script:

1. Copy env: `cp .env.example .env` and set `APP_HOST=localhost`
2. `touch 216labs.db .env.admin`
3. `APP_HOST=localhost TOOLKIT_LOCAL=1 python3 scripts/generate-caddyfile.py Caddyfile.local`
4. Set `ADMIN_PASSWORD_HASH_B64` (see bootstrap script or `caddy hash-password`)
5. `docker compose --env-file .env.toolkit -f docker-compose.yml -f docker-compose.toolkit.yml up -d --build caddy activator admin landing hello-nextjs hello-flask`

Deploy without a local DB (e.g. CI) uses `config/toolkit-default-enabled.txt` — edit that file to change the default app set for no-DB runs.

## Greenfield / community fork

To publish a trimmed starter from this repo:

1. Run `./scripts/bootstrap-toolkit.sh --starter-config` (or `./scripts/init-toolkit-starter-config.sh`) so `config/deploy-*.txt` match the small stack.
2. Keep `internal/`, `scripts/`, `config/`, toolkit demos; remove portfolio apps you do not need.
3. Point `deploy.sh` at **your** Git remote and server path with `DEPLOY_REPO` and `DEPLOY_APP_DIR` (defaults remain `git@github.com:6cubed/216labs.git` and `/opt/216labs`).
4. Replace branding in `README.md` and manifests; keep the mechanics (manifests, deploy, admin).

**Deploy / GHCR notes:** With `DEPLOY_IMAGE_SOURCE=local`, any `DEPLOY_RUNTIME_APPS=…` subset **always rebuilds** those apps from the current tree. With default GHCR pulls plus a subset, the droplet **force-recreates** those services after `docker pull`. Put critical services in `config/ghcr-always-include.txt` if `:latest` must rebuild on every push.

## Shared Python (HTTP)

`internal/python/labs_http/` holds stdlib-only helpers (`fetch_json`, `http_probe`, `normalize_blog_items`) with consistent timeouts and error handling. Images that import it use a **repo-root** Docker build (`build.context: .` plus a `dockerfile` path under `products/…`) and `COPY internal/python/labs_http /app/labs_http`.

## Related scripts

- `./scripts/bootstrap-toolkit.sh` — plug-and-play local stack
- `./scripts/new-app.sh <id> [nextjs|flask|fastapi]` — scaffold under `products/org-platform/local/`
- `./scripts/new-colab.sh <id> ["question"]` — scaffold a standalone Colab under `colabs/`
- `./scripts/init-toolkit-starter-config.sh` — copy starter `deploy-*.txt` examples
- `./scripts/local-toolkit-up.sh` — alias for bootstrap
