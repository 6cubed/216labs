# Droplet recovery

When **SSH times out** or **all `*.6cubed.app` sites hang**, the VPS is usually **disk ~95% full**, OOM-killed containers, or a stuck Docker daemon. SSH may **authenticate** then hang opening a session — treat that as the same incident (prune + reboot).

## Fast path

```bash
./scripts/edge-smoke.sh           # confirm failure from laptop (~10s)
./scripts/droplet-recover.sh root@46.101.88.197
```

This script:

1. Prunes duplicate GHCR tags and dangling Docker data (`prune-droplet-docker.sh`)
2. `git pull` on `/opt/216labs`
3. Restarts **caddy**, **activator**, **admin**, **landing**, **maxlearn**, **storybook**, **1pageresearch**, **cron-runner**; reloads Caddy
4. Runs **`edge-smoke.sh`** from your laptop (must pass for “lights on”)

## If SSH still fails

1. [DigitalOcean](https://cloud.digitalocean.com/) → droplet **46.101.88.197** → **Access** → recovery console or power cycle
2. In console: `df -h /` — if **Use%** is 95%+, run `docker system prune -af` only if you accept re-pulling images on next deploy
3. When SSH works again, run `./scripts/droplet-recover.sh`

## Revenue after recovery

Set Stripe / merch keys in **admin → Env** (revenue readiness panel), then redeploy paid apps. Verify:

```bash
./scripts/check-revenue-env-http.sh
```
