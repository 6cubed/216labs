# Droplet: stay current with CI (GHCR)

GitHub Actions (`.github/workflows/ghcr-publish.yml`) pushes `ghcr.io/<org>/216labs/<service>:latest` on each qualifying push to `main`. Two mechanisms keep the VPS close to CI without running `./deploy.sh` from a laptop:

1. **Activator cold start** — On a cold app, `ACTIVATOR_PULL_BEFORE_COLD_START` (default `true`) pulls GHCR before the first `docker compose up`. See [`internal/platform/activator/README.md`](../internal/platform/activator/README.md).

2. **Periodic sync (this doc)** — [`scripts/droplet-ghcr-sync.sh`](../scripts/droplet-ghcr-sync.sh) walks **running** Compose services whose image is `216labs/*` (or the GHCR form), pulls the matching GHCR tag, retags to `216labs/<service>:latest`, and runs `docker compose up -d --force-recreate` for that service. Infra such as **caddy** and **activator** are skipped by default (`SYNC_EXCLUDE_SERVICES`).

3. **Admin “Pull latest”** — On the workflow dashboard, each app row has a **Pull latest** control (GHCR column). It runs the same script with `SYNC_SERVICE=<compose service>` so you can refresh one image immediately after CI without waiting for the 20-minute timer or running `./deploy.sh` from a laptop. Requires the service to be **running** and uses the same GHCR credentials as periodic sync.

4. **Resource pressure (disk + cap)** — [`scripts/droplet-resource-pressure.sh`](../scripts/droplet-resource-pressure.sh) runs **before** each GHCR sync (and can run on its own timer). It `docker image prune`s dangling layers, then **LRU-stops** evictable Compose services (same **protected** list as the activator: `ACTIVATOR_PROTECTED_SERVICES`) until either free space on `/` is at least **`DROPLET_MIN_FREE_MB`** (default 2048) or the count of running evictable containers is ≤ **`DROPLET_MAX_EVICTABLE_RUNNING`** (default **10**; set **`0`** for count-only-off / disk-pressure-only). Optional **`DROPLET_PRUNE_IMAGE_ON_EVICTION=1`** removes `216labs/<svc>:latest` after stop (frees more disk; next cold start pulls from GHCR). This complements the activator’s in-process LRU (`ACTIVATOR_MAX_CONCURRENT_APPS`); see [`docs/SCALING.md`](SCALING.md).

## One-time install (systemd)

From the repo on the droplet (paths assume `/opt/216labs`):

```bash
sudo cp config/systemd/216labs-ghcr-sync.service /etc/systemd/system/
sudo cp config/systemd/216labs-ghcr-sync.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now 216labs-ghcr-sync.timer
```

**Proactive pressure relief** (recommended on tight disks):

```bash
sudo cp config/systemd/216labs-resource-pressure.service /etc/systemd/system/
sudo cp config/systemd/216labs-resource-pressure.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now 216labs-resource-pressure.timer
```

Set `DROPLET_MIN_FREE_MB`, `DROPLET_MAX_EVICTABLE_RUNNING`, etc. in `/opt/216labs/.env` or `.env.admin` as needed.

Check: `systemctl list-timers | grep 216labs` and `journalctl -u 216labs-ghcr-sync.service -n 50` / `journalctl -u 216labs-resource-pressure.service -n 50`.

Run once manually:

```bash
SYNC_PROJECT_ROOT=/opt/216labs /opt/216labs/scripts/droplet-ghcr-sync.sh
```

Ensure `GHCR_USERNAME` / `GHCR_TOKEN` (read:packages) are set in `.env` or admin **Environment** (stored in `216labs.db`) if packages are private.

## Cron alternative

```cron
*/20 * * * * SYNC_PROJECT_ROOT=/opt/216labs /opt/216labs/scripts/droplet-ghcr-sync.sh >> /var/log/216labs-ghcr-sync.log 2>&1
```

## Notes

- Same-digest `docker pull` is cheap (manifest check). `--force-recreate` after each successful pull restarts the container when CI published a new image.
- If pulls fail with **no space left on device**, lower **`DROPLET_MIN_FREE_MB`**, raise eviction aggressiveness, set **`DROPLET_MAX_EVICTABLE_RUNNING`**, and/or enable **`DROPLET_PRUNE_IMAGE_ON_EVICTION`** — then `git pull` on the server and re-run the scripts (or wait for timers).
- This does **not** change which services are enabled; it only updates images for services that are already running.
- Full stack changes (new services, Caddyfile, env) still need `git pull` on the server and/or a deploy workflow you control.
