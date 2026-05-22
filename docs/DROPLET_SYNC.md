# Droplet: stay current with CI (GHCR)

GitHub Actions (`.github/workflows/ghcr-publish.yml`) pushes `ghcr.io/<org>/216labs/<service>:latest` on each qualifying push to `main`. Services in `config/ghcr-always-include.txt` are **required** matrix rows (build step must pass); other rows use `continue-on-error` so a flaky login on an unrelated app does not block spine images. Two mechanisms keep the VPS close to CI without running `./deploy.sh` from a laptop:

1. **Activator cold start** — On a cold app, `ACTIVATOR_PULL_BEFORE_COLD_START` (default `true`) pulls GHCR before the first `docker compose up`. See [`internal/platform/activator/README.md`](../internal/platform/activator/README.md).

2. **Periodic sync (this doc)** — [`scripts/droplet-ghcr-sync.sh`](../scripts/droplet-ghcr-sync.sh) walks **running** Compose services whose image is `216labs/*` (or the GHCR form), pulls the matching GHCR tag, retags to `216labs/<service>:latest`, and runs `docker compose up -d --force-recreate` for that service. **Spine + revenue hot pool** (`caddy`, `activator`, `admin`, `landing`, `cron-runner`, `storybook`, `maxlearn`, `1pageresearch`) are skipped by default (`SYNC_EXCLUDE_SERVICES`); use `SYNC_SERVICE=admin` for a targeted pull. After sync the script regenerates the Caddyfile and runs [`droplet-ensure-spine.sh`](../scripts/droplet-ensure-spine.sh). [`droplet-resource-pressure.sh`](../scripts/droplet-resource-pressure.sh) will not LRU-stop those protected services.

3. **Admin “Pull latest”** — On the workflow dashboard, each app row has a **Pull latest** control (GHCR column). It runs the same script with `SYNC_SERVICE=<compose service>` so you can refresh one image immediately after CI without waiting for the 20-minute timer or running `./deploy.sh` from a laptop. Requires the service to be **running** and uses the same GHCR credentials as periodic sync.

4. **Resource pressure (disk + cap)** — [`scripts/droplet-resource-pressure.sh`](../scripts/droplet-resource-pressure.sh) runs **before** each GHCR sync (and can run on its own timer). It `docker image prune`s dangling layers, then **LRU-stops** evictable Compose services (same **protected** list as the activator: `ACTIVATOR_PROTECTED_SERVICES`) until either free space on `/` is at least **`DROPLET_MIN_FREE_MB`** (default 2048) or the count of running evictable containers is ≤ **`DROPLET_MAX_EVICTABLE_RUNNING`** (default **6**; set **`0`** for count-only-off / disk-pressure-only). Optional **`DROPLET_PRUNE_IMAGE_ON_EVICTION=1`** removes `216labs/<svc>:latest` after stop (frees more disk; next cold start pulls from GHCR). This complements the activator’s in-process LRU (`ACTIVATOR_MAX_CONCURRENT_APPS`); see [`docs/SCALING.md`](SCALING.md).

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

**GHCR auth:** Public packages pull **without** credentials. Set `GHCR_USERNAME` / `GHCR_TOKEN` (read:packages) in `.env` or admin **Environment** (`216labs.db`) **only if** your GHCR packages are **private**.

## Cron alternative

```cron
*/20 * * * * SYNC_PROJECT_ROOT=/opt/216labs /opt/216labs/scripts/droplet-ghcr-sync.sh >> /var/log/216labs-ghcr-sync.log 2>&1
```

## Notes

- **New app subdomains:** The activator can cold-start any app that exists in `docker-compose.yml` on the droplet and has a GHCR image, but **`./deploy.sh` only pulls images and runs `compose up` for apps in the deploy catalogue** (server DB + `config/deploy-bootstrap.txt`), capped by **`DEPLOY_MAX_APPS` (default 11)** and ordered by **`config/deploy-priority.txt`**. If a new app is missing from that cut, add its id to bootstrap and near the top of deploy-priority, push, then redeploy so the image is pulled and the service is started; regenerate the Caddyfile (`scripts/generate-caddyfile.py`) before deploy if you added a manifest.
- Same-digest `docker pull` is cheap (manifest check). `--force-recreate` after each successful pull restarts the container when CI published a new image.
- If pulls fail with **no space left on device**, lower **`DROPLET_MIN_FREE_MB`**, raise eviction aggressiveness, set **`DROPLET_MAX_EVICTABLE_RUNNING`**, and/or enable **`DROPLET_PRUNE_IMAGE_ON_EVICTION`** — then `git pull` on the server and re-run the scripts (or wait for timers). Run **`docker builder prune -af`** if build cache is large. **Duplicate tags:** after GHCR pull + retag, both `ghcr.io/6cubed/216labs/<svc>:latest` and `216labs/<svc>:latest` can sit on disk (~2× image bytes). Run **`./scripts/prune-droplet-docker.sh`** (or let **`./deploy.sh`** prune when `/` is ≥88% full before image transfer). **Never `docker compose build` on the droplet** — after `docker pull` + `docker tag ghcr.io/…/216labs/<svc>:latest 216labs/<svc>:latest`, use **`docker compose up -d <svc> --no-build --force-recreate`** (or `./deploy.sh` from a laptop, which pulls from GHCR).
- **`DEPLOY_IMAGE_SOURCE=local`:** `deploy.sh` now transfers when the **image ID** for a tag differs on the server (not only when the tag is missing), so local builds are not skipped after `DEPLOY_SKIP_BUILD=1`.
- **SSH blips after transfer:** If the long remote deploy script drops mid-session (common at ~89% disk / MaxStartups), `deploy.sh` retries `docker compose up --force-recreate` for **changed services only**. Manual fallback: `ssh root@<host> 'cd /opt/216labs && docker compose up -d --force-recreate <svc>'`. Use **`DEPLOY_RUNTIME_APPS="a b"`** (spaces, not commas) for subset deploys.
- **`droplet-ghcr-sync.sh`** runs **`scripts/lib/prune-ghcr-duplicate-tags.sh`** after each sync pass so timers do not refill disk with duplicate `ghcr.io` + `216labs` tags.
- This does **not** change which services are enabled; it only updates images for services that are already running.
- Full stack changes (new services, Caddyfile, env) still need `git pull` on the server and/or a deploy workflow you control.
