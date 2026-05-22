# Thread close-outs (heartbeat log)

Decisive end states for recurring Telegram/chat threads so the next session does not re-litigate them.

## Droplet / edge — **lights on** (2026-05-22, stable ~14:35 UTC)

`./scripts/edge-smoke.sh` **passing**: admin 401, landing 200, maxlearn `ready=true`, storybook/1page JSON (`ready=false` until Stripe keys). VPS git **`8f0fd317`** (spine excluded from default GHCR sync, `08a33bef`). If edge dies again: `./scripts/droplet-spine-up.sh` — not full recover unless disk/OOM.

## Droplet wedged / “everything down” (2026-05-21–22) — **CLOSED (procedure)**

| Symptom | Meaning | Action |
|---------|---------|--------|
| SSH banner timeout | Disk ~91%+ or OOM | DO **Power → Reboot** → `./scripts/wait-for-droplet.sh` |
| `edge-smoke` all `000` | Caddy/spine down | `./scripts/droplet-recover.sh` (prune + showroom-stop + compose up) |
| Partial smoke (admin 401, storybook JSON, landing `000`) | Spine flaky, demos hoarding RAM | `./scripts/droplet-spine-up.sh` when SSH works |
| Disk 91%, 42 containers | Too many hot demos | Recover runs **`droplet-showroom-stop.sh`** at ≥88% (`0acee151`) |

**Do not** re-debug from scratch each heartbeat — run spine-up or recover, then `edge-smoke.sh`.

**Not automatable here:** `DIGITALOCEAN_ACCESS_TOKEN` in repo `.env` for `./scripts/droplet-reboot.sh` (optional; dashboard reboot is fine).

## MaxLearn — “can’t access” (2026-05-20) — **CLOSED (code); ops when container down**

| Item | Status |
|------|--------|
| Empty DB / Wikipedia blocked | **Fixed** — `seed_fallback.json`, `MIN_USABLE_SNIPPETS=20`, fast `/api/next` |
| Activator eviction | **Mitigated** — `activator_never_evict` |
| Container not running | **Ops** — `docker compose up -d maxlearn` or `./scripts/droplet-spine-up.sh` |

**Verify:** `curl https://maxlearn.6cubed.app/api/seed-status` → `ready: true`, `seed_snippets` ≥ 20.

## StoryMagic + 1Page — revenue (2026-05-20–22) — **CLOSED (blocked on keys)**

| Item | Status |
|------|--------|
| Waitlist / print interest | **Shipped** |
| Checkout probes + admin link | **Shipped** — `setupUrl`, `missingKeys` on `/api/checkout/ready` |
| Stripe checkout live | **Blocked (you)** — edge is up; set keys at [admin Env](https://admin.6cubed.app/env) → Save (hot-reloads **storybook** on VPS). Guide: [`docs/FIRST-SALE.md`](FIRST-SALE.md) |

When stack is up, `./scripts/check-revenue-env-http.sh` shows `ready: false` with **setup:** URL until keys are set. **No further code required** until keys exist.

## Revenue / edge monitoring (2026-05-21)

| Piece | Role |
|-------|------|
| `./scripts/edge-smoke.sh` | Parallel probe; landing tries **www**; maxlearn falls back to `/healthz` |
| Cron `revenue-env-check` | 08:00 & 20:00 UTC; Telegram on failure |
| Admin **Env** | Live probes + revenue panel |

## Deploy drift on droplet

```bash
cd /opt/216labs && git pull && docker compose up -d --force-recreate maxlearn storybook admin
```

Or laptop: `DEPLOY_RUNTIME_APPS="maxlearn storybook admin" ./deploy.sh root@46.101.88.197`
