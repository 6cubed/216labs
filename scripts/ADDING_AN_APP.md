# Adding a New App

**At 216Labs we are building the toolkit for production grade vibes.** Apps in this monorepo ship through one pipeline; the steps below wire a new service into it. For reference implementations, see **`products/org-platform/toolkit-demos/`** (`hello-nextjs`, `hello-flask`) and **`docs/TOOLKIT.md`**.

New to the repo? Bring up the local shell first: `./scripts/bootstrap-toolkit.sh`.

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

## 5. Wire centralized error reporting

Production apps POST client/server errors to **`https://admin.6cubed.app/api/public/report-error`** (see **`docs/REPOSITORY.md`**). Copy from the toolkit demos:

| Stack | Reference |
|-------|-----------|
| **Next.js** | `products/org-platform/toolkit-demos/hello-nextjs` or `products/org-growth/ads/marketing` — `@216labs/errors`, `transpilePackages`, `<ClientErrorReporter appId="…" />`, repo-root Docker + `scripts/docker-build-errors-package.sh`, `/healthz` optional |
| **Vite + Express** | `products/org-social/ytsync` or `products/org-media/RamblingRadio` — `installBrowserErrorReporting({ appId })` in `client/src/main.tsx`; esbuild allowlist + `packages: "bundle"` when bundling the server |
| **Flask / Jinja** | `products/org-growth/ads/landing`, `products/org-lifestyle/play/avatar`, `products/org-platform/local/explore` — COPY `internal/python/client_error_report.py`, `client_error_script("app-id")` in template with `client_error_script_html` (Jinja safe filter), `@app.errorhandler(500)` → `report_server_error` |
| **FastAPI** | `products/org-platform/ai/bird-perch`, `products/org-platform/ai/ctfbench` — same Python module; Jinja `client_error_script()` or inject at `<!-- CLIENT_ERRORS -->` in static HTML |
| **Node status UI** | `internal/security/pipesecure` — `src/error-report.ts` (`clientErrorScript` + `reportServerError`) embedded in `status.ts` HTML |
| **Flutter** | `products/org-lifestyle/play/anchor/frontend` — `ErrorReporter` |
| **Legacy inline** | `products/org-social/mediate` — inline `onerror` in templates (still valid) |

**GHCR:** Add the compose **service name** to **`config/ghcr-always-include.txt`** when the app is in **`config/deploy-bootstrap.txt`** or you need every push to refresh `:latest`.

**Monitoring:** After wiring, add the app to the right file in **`config/README-errors-reporting.md`** (public HTML, SPA chunk, and/or droplet internal probe).

Verify:

```bash
./scripts/audit-client-error-reporting.sh
HEARTBEAT_SKIP_DROPLET=1 ./scripts/heartbeat-stack-check.sh
```

## 6. Build your app, commit, and ship

```bash
git add .
git commit -m "feat: add <app-id>"
git push origin main
```

CI publishes images to GHCR. When you want the droplet to pull and restart, run `./deploy.sh root@46.101.88.197` from your own environment (not required for every commit).

The admin dashboard auto-picks up the new app on next startup (reads `manifest.json`).
Env vars defined in `manifest.json` are seeded into the admin DB (empty values, fill them in the UI).

---

## Production droplet: images from CI (GHCR), not Docker Hub

Default `./deploy.sh` pulls `216labs/*` from **GHCR** after `.github/workflows/ghcr-publish.yml` publishes `latest`. Legacy: `DEPLOY_IMAGE_SOURCE=local` builds on your machine and streams images over SSH. On the droplet, `COMPOSE_PULL_POLICY=never` and `docker compose up ... --pull never` so Compose does not resolve `216labs/*` via Docker Hub; sync/cold-start pulls GHCR instead (**public** GHCR packages do not require a PAT; **private** packages need `GHCR_TOKEN` / `GHCR_USERNAME`).

## How the pieces fit together

| File | Purpose |
|---|---|
| `<app>/manifest.json` | Source of truth: metadata, ports, env vars. Optional `env_prefix` for admin env grouping. |
| `config/deploy-bootstrap.txt` | Optional: a few IDs to pre-`deploy_enabled` on admin sync (greenfield). Prefer admin toggles in production. |
| `config/deploy-priority.txt` | Deploy order; we cap to `DEPLOY_MAX_APPS` from this list. Edit this instead of code. |
| `docker-compose.yml` | Service definitions (manual today; at scale use `scripts/generate-compose.py` for app blocks) |
| `Caddyfile` | Auto-generated from manifests via `scripts/generate-caddyfile.py` |
| `deploy.sh` | Reads config files + manifests via `scripts/app-lookup.py` for build contexts |
| `internal/admin` | Discovers apps from filesystem, syncs from manifests; env prefix derived from manifest |

See **docs/SCALING.md** for scaling to 100s–1000s of apps and agent concurrency.

## Special cases (no manifest needed)

- **anchor** — multi-service (backend + frontend), hardcoded in deploy.sh and Caddyfile
- **pipesecure-worker / pipesecure-migrate** — sub-services of `pipesecure`, handled via `service_deps()`
