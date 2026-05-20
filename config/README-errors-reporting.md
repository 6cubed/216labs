# Error reporting — config files

Keep these lists aligned when you wire a new app to admin ingest (`POST /api/public/report-error`).

| File | Purpose |
|------|---------|
| `ghcr-always-include.txt` | Compose services **required** in every GHCR matrix run (so `:latest` is not stale after app-only commits). |
| `errors-runtime-services.txt` | Node images that must pass `scripts/verify-image-errors-runtime.sh` before GHCR push (`@216labs/errors` in server bundle). |
| `errors-html-probe-apps.txt` | Public homepage must contain `report-error` in **inline HTML** (`landing` uses root host `6cubed.app`, not `landing.6cubed.app`). |
| `errors-html-probe-spa-apps.txt` | Reporter lives in a JS chunk; `heartbeat-stack-check.sh` scans `/_next/static/**/*.js` and `/assets/*.js`. |
| `errors-html-probe-droplet.txt` | `app_id\|port` or `app_id\|port\|slow` — in-container probe via `./scripts/probe-droplet-reporters.sh`. Use `\|slow` when the app needs a long bind (e.g. birdperch model preload): 6×12s retries, 45s HTTP timeout. |

**Heartbeats:** `./scripts/heartbeat-stack-check.sh` reads the probe lists. **Audit (code):** `./scripts/audit-client-error-reporting.sh`.

**Deploy subset:** `DEPLOY_RUNTIME_APPS=birdperch` works even when the app is outside the 11-app catalogue cap, as long as `docker-compose.yml` defines the service (`deploy.sh` NOTE line).

Wiring patterns: `packages/errors/README.md`, `scripts/ADDING_AN_APP.md` §5.
