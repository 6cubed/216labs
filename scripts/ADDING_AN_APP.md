# Adding a New App

**At 216Labs we are building the toolkit for production grade vibes.** Apps in this monorepo ship through one pipeline; the steps below wire a new service into it. For reference implementations, see **`products/org-platform/toolkit-demos/`** (`hello-nextjs`, `hello-flask`) and **`docs/TOOLKIT.md`**.

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

## 4. Add a Happy Path test (for apps with critical flows)

If the app has a critical user flow (e.g. model load, chat, form submit), add a test so the regular Happy Path run catches regressions:

1. **Stub mode in the app** — When `?happypath=1` is in the URL, skip real external/expensive work (e.g. real LLM load, real API calls) and fake success so the test can run without WebGPU/network. See `products/org-platform/ai/pocket` and `products/org-platform/ai/offlinellm` for examples.
2. **Dedicated test in `internal/quality/happypath/src/runner.ts`** — Add `run<AppId>Test(browser, baseUrl)` that opens `baseUrl?happypath=1`, drives the flow (click load, fill form, etc.), and asserts the expected outcome. Return a `RunResult`.
3. **Wire the test** — In `runAllTests()`, when `appId === "<app-id>"`, call your test instead of `runTestForApp()`.
4. **Default app list** — In `internal/quality/happypath/src/db.ts`, add `<app-id>` to the fallback array in `getEnabledAppIds()` so the test runs when the admin DB isn’t available.

Without this, basic failures (e.g. model load error, broken button) can ship until someone manually tests.

## 5. Build your app, commit, and deploy

```bash
git add .
git commit -m "feat: add <app-id>"
git push origin main
./deploy.sh root@46.101.88.197
```

The admin dashboard auto-picks up the new app on next startup (reads `manifest.json`).
Env vars defined in `manifest.json` are seeded into the admin DB (empty values, fill them in the UI).

---

## Production droplet: don’t pull `216labs/*` from Docker Hub

Images are built on your machine and transferred with `deploy.sh`. On the droplet, `deploy.sh` sets `COMPOSE_PULL_POLICY=never` and runs `docker compose up ... --pull never` so Compose never tries to pull `216labs/*` from Docker Hub (which would fail). Use local `docker compose` with the same flags if you bring stacks up by hand.

## How the pieces fit together

| File | Purpose |
|---|---|
| `<app>/manifest.json` | Source of truth: metadata, ports, env vars. Optional `env_prefix` for admin env grouping. |
| `config/deploy-bootstrap.txt` | App IDs always force-included and enabled (one per line). Edit this instead of code. |
| `config/deploy-priority.txt` | Deploy order; we cap to `DEPLOY_MAX_APPS` from this list. Edit this instead of code. |
| `docker-compose.yml` | Service definitions (manual today; at scale use `scripts/generate-compose.py` for app blocks) |
| `Caddyfile` | Auto-generated from manifests via `scripts/generate-caddyfile.py` |
| `deploy.sh` | Reads config files + manifests via `scripts/app-lookup.py` for build contexts |
| `internal/admin` | Discovers apps from filesystem, syncs from manifests; env prefix derived from manifest |

See **docs/SCALING.md** for scaling to 100s–1000s of apps and agent concurrency.

## Special cases (no manifest needed)

- **anchor** — multi-service (backend + frontend), hardcoded in deploy.sh and Caddyfile
- **pipesecure-worker / pipesecure-migrate** — sub-services of `pipesecure`, handled via `service_deps()`
