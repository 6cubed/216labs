# Adding a New App

Run the scaffold script to create the directory, `manifest.json`, and a starter `Dockerfile`:

```bash
./scripts/new-app.sh <app-id> [nextjs|flask|fastapi]
# e.g.
./scripts/new-app.sh myapp nextjs
```

Then complete these steps:

## 1. Fill in `manifest.json`

Edit `<app-id>/manifest.json` with your app's real metadata and env vars.
This file is the single source of truth — it drives the admin DB, deploy script, and Caddyfile.

## 2. Add to `docker-compose.yml`

The scaffold script prints the snippet to paste. Copy it in. If your app needs volumes, secrets, or `depends_on`, add those too.

## 3. Regenerate the Caddyfile

```bash
python3 scripts/generate-caddyfile.py
```

## 4. Build your app, commit, and deploy

```bash
git add .
git commit -m "feat: add <app-id>"
git push origin main
./deploy.sh root@46.101.88.197
```

The admin dashboard auto-picks up the new app on next startup (reads `manifest.json`).
Env vars defined in `manifest.json` are seeded into the admin DB (empty values, fill them in the UI).

---

## How the pieces fit together

| File | Purpose |
|---|---|
| `<app>/manifest.json` | Source of truth: metadata, ports, env vars |
| `docker-compose.yml` | Service definitions (still manual — too many unique configs) |
| `Caddyfile` | Auto-generated from manifests via `scripts/generate-caddyfile.py` |
| `deploy.sh` | Reads `manifest.json` via `scripts/app-lookup.py` for build contexts |
| `216labs_admin/src/lib/db.ts` | Reads manifests on startup to upsert app metadata & seed env vars |

## Special cases (no manifest needed)

- **anchor** — multi-service (backend + frontend), hardcoded in deploy.sh and Caddyfile
- **pipesecure-worker / pipesecure-migrate** — sub-services of `pipesecure`, handled via `service_deps()`
