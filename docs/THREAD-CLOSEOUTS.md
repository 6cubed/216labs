# Thread close-outs (heartbeat log)

Decisive end states for recurring Telegram/chat threads so the next session does not re-litigate them.

## Droplet cron secret — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `run-droplet-cron.sh` → `CRON_RUNNER_SECRET missing in env_vars` | `./scripts/ensure-droplet-cron-secret.sh` (bootstrap DB + `.env.admin` + recreate cron-runner) |
| Stale `revenue_env_last` | After secret fix: `./scripts/run-droplet-cron.sh revenue-env-check` |

**Verify:** `grep CRON_RUNNER_SECRET /opt/216labs/.env.admin` on VPS (value not printed). `deploy.sh` now bootstraps empty panel secrets before export.

**Note:** `heartbeat-stack.sh` runs `PRAGMA wal_checkpoint` before reading `cron_runner_state` (cron-runner uses WAL; naive host reads were stale).

---

## Production snapshot (2026-05-28 ~02:10 UTC)

| Check | Result |
|-------|--------|
| Stack | `heartbeat-stack.sh` OK |
| Cron ops | **Shipped** — bootstrap on deploy + `ensure-droplet-cron-secret.sh` + `run-droplet-cron` fallbacks |
| First paid checkout | **BLOCKED (you)** — `STORYBOOK_STRIPE_*` in admin Env |

---

## Production snapshot (2026-05-28 ~01:40 UTC)

| Assumption (earlier today) | Still true? |
|----------------------------|-------------|
| Stack / edge up | **Yes** — `heartbeat-stack.sh` OK |
| StoryMagic closest to revenue | **Yes** — waitlist + GA4 + UTMs shipped |
| Stripe blocks first sale | **Yes** — `ready: false`; keys in admin Env |
| Merch storefront dead | **No** — `[Merch] storefront URL appears configured` |
| Ads API in repo | **No** — closed; Meta/Google UIs only |
| Org-metrics git broken | **No** — fixed (`git` in admin image) |
| `revenue_env_last` admin failed | **Stale cron row** — probe uses internal admin first; refresh via `revenue-env-check` |
| Droplet disk **93%** | **Pruned** — now **~92%**, **~2.1G** free (`prune-droplet-docker.sh`) |

**Shipped this beat:** Telegram **lead-notify** includes ad **campaign** line for StoryMagic print leads.

---

## Production snapshot (2026-05-28 ~01:10 UTC)

| Check | Result |
|-------|--------|
| **Org metrics git** | **Shipped** — `git` in admin image; commits populate at `/org-metrics` |
| **CEO leads hub** | **Shipped** — StoryMagic print leads + UTMs on [admin → Leads](https://admin.6cubed.app/leads) |
| Droplet disk | **Watch** — deploys saw **~92%**; run `./scripts/prune-droplet-docker.sh root@46.101.88.197` if SSH/transfer flaps |

---

## Meta / Google Ads API — **CLOSED**

| Question | Answer |
|----------|--------|
| “Is there an ads API?” | **No** in-repo Marketing API. Run Meta/Google ads in their UIs. |
| Measure + attribute | GA4 events on StoryMagic; **UTM → waitlist** → admin **Leads** / **Orders** |

Playbook: [`docs/STORYMAGIC-ADS.md`](STORYMAGIC-ADS.md). **Verify:** ad URL with `utm_campaign=test` → waitlist → **Campaign** column on Leads.

---

## Production snapshot (2026-05-28 ~00:40 UTC)

| Check | Result |
|-------|--------|
| Edge / stack | `./scripts/heartbeat-stack.sh` — lights on (admin 401, landing/storybook/maxlearn OK) |
| StoryMagic ads attribution | **Shipped** — UTM capture on waitlist → admin Orders **Campaign** column |
| First paid checkout | **Blocked (you)** — `STORYBOOK_STRIPE_*` in [admin Env](https://admin.6cubed.app/env) |
| Meta/Google Ads API in repo | **None** — run campaigns in platform UIs; measure via GA4 + admin leads |

---

## Production snapshot (2026-05-28 ~00:15 UTC)

| Check | Result |
|-------|--------|
| StoryMagic monetization beat | **Shipped** — GA4 conversion events + [`docs/STORYMAGIC-ADS.md`](STORYMAGIC-ADS.md) |
| First paid checkout | **Blocked (you)** — `STORYBOOK_STRIPE_*` in [admin Env](https://admin.6cubed.app/env) |
| Closest live revenue app | **StoryMagic** — waitlist + ads-ready measurement; purchase after Stripe |

---

## Production snapshot (2026-05-27 ~21:45 UTC)

| Check | Result |
|-------|--------|
| `./scripts/edge-smoke.sh` | Re-run after recover — admin/landing expected up |
| VPS DB | **Restored** from `216labs.db.bak.202605271702` (corrupt DB + WAL dir mounts) |
| Admin **Org metrics** | **Shipped** `fe48a9bb` — https://admin.6cubed.app/org-metrics after admin up |
| First paid checkout | **Blocked (you)** — `STORYBOOK_STRIPE_*` + `ONEPAGE_STRIPE_*` in [admin Env](https://admin.6cubed.app/env) |
| Pocket bridge autoprompt | **ON** — `/autoprompt on` |

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

## StoryMagic revenue — **CLOSED (product + measurement); blocked on Stripe keys**

| Shipped | Blocker |
|---------|---------|
| Waitlist-first preview; print-interest → admin **Leads**; admin Save hot-reloads storybook | **2** test keys → [admin Env](https://admin.6cubed.app/env) |
| **GA4 funnel events** + **UTM on waitlist** (admin Orders campaign column) | Mark conversions in GA4 |
| CEO ads playbook | [`docs/STORYMAGIC-ADS.md`](STORYMAGIC-ADS.md) |

Guide: [`docs/FIRST-SALE.md`](FIRST-SALE.md). Verify checkout: `./scripts/check-revenue-env-http.sh` → `[StoryMagic] checkout ready`. **Next revenue unlock:** paste Stripe keys + Save (not more funnel UX).

---

## Pocket bridge — auto-approve all confirmations — **CLOSED**

| Item | Status |
|------|--------|
| `/autoprompt on` (`.auto_approve_prompts`) | **Default ON** for owner |
| Allow / Yes / OK labels + live DOM scrape + fallback click + retries | **`7cb64d9b`** |
| Bridge restart after bridge code changes | `./scripts/pocket-cursor-bridge.sh` |

If confirmations still hit Telegram: note button labels; extend `_AUTOPROMPT_ACCEPT_KEYWORDS` in `lib/command_rules.py`.

---

## Admin revenue env hot-reload — **CLOSED**

| Item | Status |
|------|--------|
| `/workspace` **ro** + `.env.admin` **rw** bind on admin container | **`7cb64d9b`** |
| Save `STORYBOOK_*` / `ONEPAGE_*` → regenerate `.env.admin` + `compose up` service | `env-compose-sync.ts` |
| Removed `apply-revenue-env-on-droplet.sh` | Use admin Save first |

---

## Deploy — subset flapped Caddy — **CLOSED (`898ceb07`)**

`DEPLOY_RUNTIME_APPS=storybook landing` (etc.) without `DEPLOY_SHOWROOM=1` used to `compose up` the **full catalogue** (missing images e.g. groundtruth) and briefly kill edge. **Now:** phase 2 = spine + subset only; post-deploy Caddy regen/reload.

---

## Admin deploy / `216labs.db-shm` mount — **CLOSED (fix shipped)**

| Symptom | Fix |
|---------|-----|
| `mount ... 216labs.db-shm: not a directory` | Docker created **directories** for missing WAL bind targets |
| DB `unable to open` / corrupt | Restored from **`216labs.db.bak.202605271702`** |
| cron-runner restart loop | Compose: drop `-wal`/`-shm` mounts; **`journal_mode=DELETE`** |

**Verify:** `./scripts/fix-sqlite-wal-mounts.sh root@46.101.88.197` then `docker compose up -d admin activator cron-runner`. **Org metrics:** https://admin.6cubed.app/org-metrics

---

## Monitoring

| Piece | Role |
|-------|------|
| `./scripts/edge-smoke.sh` | Heartbeat first check |
| `./scripts/heartbeat-stack.sh` | Smoke + cron snapshot (`python3` on VPS; no host `sqlite3`) + recover |
| Cron `revenue-env-check` / `stack-health-check` | Revenue + edge/internal probes (`cron-runner` seeds missing jobs on tick) |
| Admin **Env** | Revenue readiness panel + hot-reload storybook on `STORYBOOK_*` save |

Targeted deploy:

```bash
DEPLOY_RUNTIME_APPS="storybook" ./deploy.sh root@46.101.88.197
```
