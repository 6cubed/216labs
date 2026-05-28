# Thread close-outs (heartbeat log)

Decisive end states for recurring Telegram/chat threads so the next session does not re-litigate them.

## Caddy crash after deploy (missing ADMIN_PASSWORD_HASH) — **CLOSED**

| Symptom | Fix |
|---------|-----|
| Caddy restart loop: `username and password are required` | `scripts/ensure-admin-caddy-hash.py` on deploy (derives hash from `ADMIN_PANEL_PASSWORD`) |
| Edge `000` / admin unreachable | `./scripts/reset-admin-basic-auth.sh` if hash still missing |

**Verify:** `deploy.sh` logs no Caddy provision error; `docker ps` shows `caddy` Up; `edge-smoke` admin **401**.

---

## Revenue probe — merch false negative — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `revenue_env_last` → `merch: fetch failed` while edge OK | **Shipped** — `probeMerchStorefront()` uses **Caddy Host** routing (same as stack-health), not outbound HTTPS from cron-runner |

**Verify:** `./scripts/run-droplet-cron.sh revenue-env-check` then `./scripts/heartbeat-stack.sh` → `revenue_env_last` issues **0** (StoryMagic/1Page may still show `ready: false` until Stripe keys).

---

## Droplet cron secret — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `run-droplet-cron.sh` → `CRON_RUNNER_SECRET missing in env_vars` | `./scripts/ensure-droplet-cron-secret.sh` (bootstrap DB + `.env.admin` + recreate cron-runner) |
| Stale `revenue_env_last` | After secret fix: `./scripts/run-droplet-cron.sh revenue-env-check` |

**Verify:** `grep CRON_RUNNER_SECRET /opt/216labs/.env.admin` on VPS (value not printed). `deploy.sh` now bootstraps empty panel secrets before export.

**Note:** `heartbeat-stack.sh` reads `cron_runner_state` via **docker exec cron-runner** (WAL-safe). Do not `PRAGMA wal_checkpoint(TRUNCATE)` on the host DB while containers are up.

---

## Merch revenue probe false negative (Caddy 308) — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `revenue_env_last` → `merch: fetch failed` while edge OK | **Shipped** — `probeMerchStorefront()` tries **`http://merch:3000/`** first (then Caddy Host, then edge) so redirects/empty bodies don’t cause false negatives |

**Verify:** `./scripts/run-droplet-cron.sh revenue-env-check` → `issues: 0` in `./scripts/heartbeat-stack.sh`.

---

## Cron-runner run-server visibility (half-finished) — **CLOSED**

| Symptom | Fix |
|---------|-----|
| Unclear if cron-runner HTTP server is up during SSH flaps | **Shipped** — `GET /health` on cron-runner + `./scripts/probe-cron-runner-health.sh` with retries |

**Verify:** `./scripts/probe-cron-runner-health.sh` prints `{"ok":true,"service":"cron-runner"}`.

---

## SSH refused while edge OK — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `ssh: connect ... port 22: Connection refused` while `admin.6cubed.app` still responds | **Shipped** — `./scripts/wait-for-ssh.sh` to make post-reboot recovery one-command (use `wait-for-droplet.sh` when you also want auto-recover) |

**Verify:** `./scripts/wait-for-ssh.sh root@46.101.88.197` exits 0; then `./scripts/heartbeat-stack.sh`.

---

## Local heartbeat noise (`base64` / `dump_zsh_state`) — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `base64: /dev/stdout: Operation not permitted` and `command not found: dump_zsh_state` lines in local heartbeat output | Not a stack problem — it’s emitted by the local tool wrapper in some sandboxes. Ignore; edge + cron snapshots are still valid. |

**Verify:** `edge-smoke: critical hosts reachable` plus `stack_health_last` / `revenue_env_last` parse normally.

---

## Revenue cron — admin false negative — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `revenue_env_last` → `admin: fetch failed` while edge OK | **Shipped** — `probeAdminResilient()` uses `GET /api/public/live-apps`; treats edge **401** (Caddy gate) as OK |

**Verify:** Checkout setup → **Run revenue probe now** → refresh; `revenue_env_last` issues **0** (StoryMagic may still be `ready: false` until Stripe keys).

---

## StoryMagic preorder (Payment Link) — **BLOCKED (CEO)**

| Item | Status |
|------|--------|
| UI + hot-reload on save | **Shipped** — inline save on [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Runtime URL on site | **Shipped** — client reads `preorderUrl` from `/api/checkout/ready` (no image rebuild after Env save) |
| Money | **You** — create Stripe Payment Link → paste URL → Save |

**Verify:** StoryMagic hero or preview → **Preorder now** opens your link (refresh page after Save).

Full checkout + admin Orders: still need `STORYBOOK_STRIPE_SECRET_KEY` + `STORYBOOK_STRIPE_WEBHOOK_SECRET` on same page.

---

## Production snapshot (2026-05-28 ~20:05 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Ops | **Shipped** — heartbeat SSH retry; admin nav dot on Checkout setup; Telegram `/checkout` live StoryMagic line |

---

## Production snapshot (2026-05-28 ~19:35 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup) Payment Link or Stripe keys |
| Ops | **Shipped** — revenue cron + heartbeat show `preorder live`; checkout-setup live probe shows preorder state |

---

## Production snapshot (2026-05-28 ~18:05 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup): Payment Link **or** 2 Stripe keys |
| Ops / probes | **Shipped** — `preorderConfigured` on checkout/ready; `/checkout` + dashboard treat preorder as live revenue path |

---

## Production snapshot (2026-05-28 ~17:35 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup): Payment Link **or** 2 Stripe keys |
| Ops | **Shipped** — revenue admin probe fix; preorder inline save |

---

## Production snapshot (2026-05-28 ~07:40 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Ops compounding | **Shipped** — Telegram `/checkout`; revenue cron **every 4h**; merch probe fixed |

---

## Production snapshot (2026-05-28 ~07:25 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → 2 Stripe keys → Save |
| Ops compounding | **Shipped** — `revenue-env-check` every **4h** (was 2×/day); Telegram **`/checkout`**; probe script points to Checkout setup |

**Verify:** `./scripts/heartbeat-stack.sh` → fresh `revenue_env_last` after next `0 */4` tick or `./scripts/run-droplet-cron.sh revenue-env-check`.

---

## Production snapshot (2026-05-28 ~06:55 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup) (webhook checklist + live probe) → paste 2 Stripe keys → Save |
| Funnel | **Ready** — waitlist count on admin Overview + First sale banner |

**Shipped:** Checkout setup Stripe webhook steps (`checkout.session.completed`); admin dashboard waitlist on revenue card; refreshed `revenue_env_last` via cron.

**Stale cron row — CLOSED:** `revenue_env_last` was hours old; `run-droplet-cron.sh revenue-env-check` refreshes it (verify in `./scripts/heartbeat-stack.sh`).

---

## Production snapshot (2026-05-28 ~06:40 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → paste test/live Stripe keys → Save |
| Funnel (ads + referrals) | **Ready** — post-waitlist **share link** (UTM `share/referral/storymagic_friend`); Telegram `/now` shows StoryMagic waitlist rows with campaign columns |

**Shipped this cycle:** `query_storybook_print_leads.sh` UTMs; pocket `/now` waitlist snippet; StoryMagic share-after-waitlist CTA.

---

## Production snapshot (2026-05-28 ~03:10 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — paste `STORYBOOK_STRIPE_SECRET_KEY` + `STORYBOOK_STRIPE_WEBHOOK_SECRET` in [admin → Checkout setup](https://admin.6cubed.app/checkout-setup) → Save |
| Funnel (ads → waitlist) | **Ready** — GA4, UTMs, [Leads](https://admin.6cubed.app/leads), Telegram pings |

**Shipped:** deploy auto-derives Caddy admin hash; StoryMagic **Open Graph** for Meta link previews.

---

## Production snapshot (2026-05-28 ~02:40 UTC)

| Check | Result |
|-------|--------|
| Stack | OK — `stack_health_last` fresh |
| Revenue cron probe | **Fixed** — merch via Caddy internal route |
| First paid checkout | **BLOCKED (you)** — `STORYBOOK_STRIPE_*` |

---

## Production snapshot (2026-05-28 ~02:10 UTC)

| Check | Result |
|-------|--------|
| Stack | `heartbeat-stack.sh` OK |
| Cron ops | **Shipped** — bootstrap on deploy + `ensure-droplet-cron-secret.sh` + `run-droplet-cron` fallbacks |
| First paid checkout | **BLOCKED (you)** — `STORYBOOK_STRIPE_*` in [admin → Checkout setup](https://admin.6cubed.app/checkout-setup) |

---

## Production snapshot (2026-05-28 ~01:40 UTC)

| Assumption (earlier today) | Still true? |
|----------------------------|-------------|
| Stack / edge up | **Yes** — `heartbeat-stack.sh` OK |
| StoryMagic closest to revenue | **Yes** — waitlist + GA4 + UTMs shipped |
| Stripe blocks first sale | **Yes** — `ready: false`; keys in [admin → Checkout setup](https://admin.6cubed.app/checkout-setup) |
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
| First paid checkout | **Blocked (you)** — `STORYBOOK_STRIPE_*` in [admin → Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Meta/Google Ads API in repo | **None** — run campaigns in platform UIs; measure via GA4 + admin leads |

---

## Production snapshot (2026-05-28 ~00:15 UTC)

| Check | Result |
|-------|--------|
| StoryMagic monetization beat | **Shipped** — GA4 conversion events + [`docs/STORYMAGIC-ADS.md`](STORYMAGIC-ADS.md) |
| First paid checkout | **Blocked (you)** — `STORYBOOK_STRIPE_*` in [admin → Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Closest live revenue app | **StoryMagic** — waitlist + ads-ready measurement; purchase after Stripe |

---

## Production snapshot (2026-05-27 ~21:45 UTC)

| Check | Result |
|-------|--------|
| `./scripts/edge-smoke.sh` | Re-run after recover — admin/landing expected up |
| VPS DB | **Restored** from `216labs.db.bak.202605271702` (corrupt DB + WAL dir mounts) |
| Admin **Org metrics** | **Shipped** `fe48a9bb` — https://admin.6cubed.app/org-metrics after admin up |
| First paid checkout | **Blocked (you)** — `STORYBOOK_STRIPE_*` + `ONEPAGE_STRIPE_*` in [admin → Checkout setup](https://admin.6cubed.app/checkout-setup) |
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
| Waitlist-first preview; print-interest → admin **Leads**; admin Save hot-reloads storybook | **2** test keys → [admin → Checkout setup](https://admin.6cubed.app/checkout-setup) |
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
