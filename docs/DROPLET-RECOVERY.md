# Droplet recovery

When **SSH times out** or **all `*.6cubed.app` sites hang**, the VPS is usually **disk ~95% full**, OOM-killed containers, or a stuck Docker daemon. SSH may **authenticate** then hang opening a session — treat that as the same incident (prune + reboot).

## Fast path

```bash
./scripts/edge-smoke.sh           # confirm failure from laptop (~10s)
./scripts/droplet-recover.sh root@46.101.88.197
```

If SSH works but only **landing** or **maxlearn** are down (admin/storybook OK), use the lighter path:

```bash
./scripts/droplet-spine-up.sh root@46.101.88.197
```

This script:

1. Prunes duplicate GHCR tags and dangling Docker data (`prune-droplet-docker.sh`)
2. When disk is **≥88% full**, stops every compose service **except** the recovery hot pool (`droplet-showroom-stop.sh` — spine + maxlearn + storybook + 1pageresearch + cron-runner). Demos cold-start again via the activator.
3. `git pull` on `/opt/216labs`
4. Restarts **caddy**, **activator**, **admin**, **landing**, **maxlearn**, **storybook**, **1pageresearch**, **cron-runner**; reloads Caddy
5. Runs **`edge-smoke.sh`** from your laptop (must pass for “lights on”)

## If SSH still fails (or disk is 97%+)

**Reboot first** — sshd/Docker often cannot recover in-place when root is full.

1. **Dashboard:** [DigitalOcean droplets](https://cloud.digitalocean.com/droplets) → select **46.101.88.197** → **Power** → **Reboot** → wait ~2 minutes.
2. **API (if you have a token):** `DIGITALOCEAN_ACCESS_TOKEN=… ./scripts/droplet-reboot.sh` (reboot, wait for SSH, then `droplet-recover.sh`). Token can live in repo `.env`.
3. **After manual reboot:** `./scripts/wait-for-droplet.sh` polls SSH (default 10 min) then runs recover.
4. **Recovery console** (if reboot is not enough): **Access** → launch console → `df -h /` then `docker system prune -af` (re-pull images on next deploy).
5. When SSH works: `./scripts/droplet-recover.sh`

## Revenue after recovery

Set Stripe / merch keys in **admin → Env** (revenue readiness panel), then redeploy paid apps. Verify:

```bash
./scripts/check-revenue-env-http.sh
```
