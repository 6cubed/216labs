# Error reporting — config files

Keep these lists aligned when you wire a new app to admin ingest (`POST /api/public/report-error`).

| File | Purpose |
|------|---------|
| `ghcr-always-include.txt` | Compose services **required** in every GHCR matrix run (so `:latest` is not stale after app-only commits). |
| `errors-runtime-services.txt` | Node images that must pass `scripts/verify-image-errors-runtime.sh` before GHCR push (`@216labs/errors` in server bundle). |
| `errors-html-probe-apps.txt` | Public homepage must contain `report-error` in **inline HTML** (`landing` uses root host `6cubed.app`, not `landing.6cubed.app`). |
| `errors-html-probe-spa-apps.txt` | Reporter lives in a JS chunk; `heartbeat-stack-check.sh` scans `/_next/static/**/*.js` and `/assets/*.js`. |
| `errors-html-probe-droplet.txt` | `app_id\|port` or `app_id\|port\|slow` — in-container probe via `./scripts/probe-droplet-reporters.sh`. Use `\|slow` when the app needs a long bind (e.g. birdperch model preload): 6×12s retries, 45s HTTP timeout. Probes use the container’s bridge IP when Next binds there instead of `127.0.0.1`. |

**Heartbeats:** `./scripts/heartbeat-stack-check.sh` reads the probe lists. Set **`HEARTBEAT_SKIP_DROPLET=1`** to skip SSH in-container probes (`birdperch|slow` can take 20+ minutes). **Audit (code):** `./scripts/audit-client-error-reporting.sh`.

**Checklist when wiring a new app** (keep code and config in sync):

1. Implement reporter (see `scripts/ADDING_AN_APP.md` §5).
2. Repo-root `build.context` in `manifest.json` + `docker-compose.yml` when using `@216labs/errors` or `client_error_report.py`.
3. Add compose **service name** to `ghcr-always-include.txt` if the app is deploy-bootstrap / deploy-priority or must not get stale `:latest`.
4. Add **app id** to one probe file: `errors-html-probe-apps.txt` (inline HTML), `errors-html-probe-spa-apps.txt` (Next/Vite chunk), and/or `errors-html-probe-droplet.txt` (activator/cold-start or non-public HTML).
5. Run `./scripts/audit-client-error-reporting.sh` and `HEARTBEAT_SKIP_DROPLET=1 ./scripts/heartbeat-stack-check.sh`.

**Deploy subset:** `DEPLOY_RUNTIME_APPS=birdperch` works even when the app is outside the 11-app catalogue cap, as long as `docker-compose.yml` defines the service (`deploy.sh` NOTE line).

Wiring patterns: `packages/errors/README.md`, `scripts/ADDING_AN_APP.md` §5.

**Activator:** On cold-start failure (`compose up` or HTTP timeout), posts `kind: server` to admin ingest with the **target app’s** `app_id` (see `internal/platform/activator/app.py` `_report_cold_start_failure`).
