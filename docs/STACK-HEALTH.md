# Stack health (edge vs internal)

Public URLs can fail while app containers are still healthy behind Caddy. The cron job **`stack-health-check`** (every 15 minutes) compares:

| Layer | Probes |
|-------|--------|
| **External** | `https://admin.6cubed.app/`, `https://6cubed.app/` |
| **Internal** (Docker network) | `http://admin:3000/api/public/live-apps`, `http://activator:3040/healthz`, `http://storybook:3000/api/checkout/ready` |

Internal probes must hit **cheap** endpoints. The admin probe is `GET /api/public/live-apps`: a read-only SQLite `SELECT` (no project sync). The dashboard at `/` is `force-dynamic`, shells out to `docker ps` and fans out HTTP calls, so it times out on a loaded droplet and reports a healthy admin as down — which then misroutes `diagnosis` away from `edge_proxy` during a real Caddy outage.

Results are stored in `216labs.db` → `cron_runner_state.stack_health_last` and surfaced on the admin dashboard (**Stack / edge** metric).

## Diagnosis

| `diagnosis` | Meaning | Typical fix |
|-------------|---------|-------------|
| `ok` | Public edge reachable | — |
| `edge_proxy` | Internal spine OK, public down | `./scripts/droplet-spine-up.sh` (Caddy reload) |
| `spine_down` | Internal + public failed | DO reboot → `./scripts/wait-for-droplet.sh` |
| `degraded` | Mixed failures | `./scripts/droplet-recover.sh` |

Telegram alerts only when external probes fail (same pattern as `revenue-env-check`).

## Heartbeats

```bash
./scripts/heartbeat-stack.sh
```

Runs `edge-smoke.sh` from your laptop and, when SSH works, prints the latest `stack_health_last` snapshot from the droplet.

## Cron secret (Run now / manual jobs)

`./scripts/run-droplet-cron.sh <job-id>` needs `CRON_RUNNER_SECRET` in `env_vars` (exported to `.env.admin`). If it is missing:

```bash
./scripts/ensure-droplet-cron-secret.sh root@46.101.88.197
./scripts/run-droplet-cron.sh revenue-env-check
```

`deploy.sh` runs `bootstrap-internal-panel-env.py` before exporting `.env.admin` so new droplets get a secret automatically.

## Enable / deploy

Job is registered in `cron-runner` on deploy. After changing handlers:

```bash
DEPLOY_RUNTIME_APPS=cron-runner,admin ./deploy.sh root@46.101.88.197
```

On an existing VPS, `git pull` + `docker compose up -d --force-recreate cron-runner admin` applies the new job without a full deploy.
