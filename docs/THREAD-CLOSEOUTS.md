# Thread close-outs (heartbeat log)

Decisive end states for recurring Telegram/chat threads so the next session does not re-litigate them.

## Production snapshot (2026-05-25 ~20:12 UTC)

| Check | Result |
|-------|--------|
| `./scripts/edge-smoke.sh` | **Passing** — admin 401, landing 200, maxlearn feed swipe OK, storybook/1page `ready=false` |
| VPS git | **`898ceb07`** (`deploy.sh` subset phase-2, post-deploy Caddy reload) |
| Disk / containers | **~91%**, **~8** running (showroom pool after recover — normal) |
| `./scripts/droplet-reboot.sh` | **Works** — `DIGITALOCEAN_ACCESS_TOKEN` in repo `.env` (gitignored) |
| First paid checkout | **Blocked (you)** — `STORYBOOK_STRIPE_*` in [admin Env](https://admin.6cubed.app/env) |

**If edge all `000` or SSH banner hang:** `./scripts/droplet-reboot.sh` → `./scripts/wait-for-droplet.sh` (runs recover). Diagnose first: `./scripts/droplet-wedge-check.sh`.

---

## Droplet wedged / “everything down” / “we back?” — **CLOSED (procedure + automation)**

| Symptom | Action |
|---------|--------|
| SSH banner hang, edge `000` | `./scripts/droplet-reboot.sh` (DO API) or dashboard Reboot → `./scripts/wait-for-droplet.sh` |
| SSH OK, edge bad | `./scripts/heartbeat-recover.sh` or `./scripts/droplet-recover.sh` |
| Partial (landing `000`, admin OK) | `./scripts/droplet-spine-up.sh` |
| Disk ≥88% during recover | **`droplet-showroom-stop.sh`** — keeps spine + maxlearn + storybook + 1pageresearch + cron-runner |

**Prevention on VPS:** `droplet-ghcr-sync.sh` **skips pulls** when root ≥90% (`SYNC_SKIP_IF_DISK_PCT_GE`). Do not re-debug each heartbeat — run the script row above.

---

## Pocket bridge — `START_ARGS unbound variable` — **CLOSED**

| Item | Status |
|------|--------|
| `set -u` + empty `START_ARGS[@]` on bash 4.4+ | **Fixed** — `${START_ARGS[@]+"${START_ARGS[@]}"}` (`90b1698e`) |
| Cursor up without CDP | `./scripts/pocket-bridge-wait-cdp.sh` or `~/Library/Application Support/Cursor/argv.json` with `remote-debugging-port` |

---

## MaxLearn — “error after first swipe” (Telegram 2026-05-22) — **CLOSED (verified 2026-05-25)**

| Cause | Fix |
|-------|-----|
| `/api/like` blocked on Wikipedia | Background neighbour expand (`bf6fdf4b`) |
| Session lost in Telegram WebView | `X-MaxLearn-Session` + `localStorage` |
| SQL `s.id` without alias | `SELECT s.id FROM snippets s …` |

**Verify:** `edge-smoke` line `maxlearn OK feed swipe HTTP 200`. Manual: https://maxlearn.6cubed.app

---

## MaxLearn — “can’t access” — **CLOSED (code); ops if container down**

`seed_fallback.json`, `MIN_USABLE_SNIPPETS=20`. If 502: `./scripts/droplet-spine-up.sh` (not a code bug).

---

## StoryMagic revenue — **CLOSED (product); blocked on Stripe keys**

| Shipped | Blocker |
|---------|---------|
| Waitlist / print-interest, `operatorHint` on `/api/checkout/ready`, landing featured CTA, no admin link on public preview | Save **3** test keys → [admin Env](https://admin.6cubed.app/env) |

Guide: [`docs/FIRST-SALE.md`](FIRST-SALE.md). When keys exist: `./scripts/check-revenue-env-http.sh` → `[StoryMagic] checkout ready`. **No more revenue code** until keys are set.

---

## Deploy — subset flapped Caddy — **CLOSED (`898ceb07`)**

`DEPLOY_RUNTIME_APPS=storybook landing` (etc.) without `DEPLOY_SHOWROOM=1` used to `compose up` the **full catalogue** (missing images e.g. groundtruth) and briefly kill edge. **Now:** phase 2 = spine + subset only; post-deploy Caddy regen/reload.

---

## Monitoring

| Piece | Role |
|-------|------|
| `./scripts/edge-smoke.sh` | Heartbeat first check |
| `./scripts/heartbeat-stack.sh` | Smoke + cron snapshot + recover attempt |
| Cron `revenue-env-check` | Stripe probe alerts |
| Admin **Env** | Revenue readiness panel + hot-reload storybook on `STORYBOOK_*` save |

Targeted deploy:

```bash
DEPLOY_RUNTIME_APPS="storybook" ./deploy.sh root@46.101.88.197
```
