# Thread close-outs (heartbeat log)

Decisive end states for recurring Telegram/chat threads so the next session does not re-litigate them.

**How to read this file:** the **latest production snapshot at the top** is canonical. Do not revive **SUPERSEDED** or **CLOSED** threads. Older "BLOCKED (CEO) — Payment Link" rows below are historical; distribution is the constraint, not Stripe.

## Production snapshot (2026-08-15 ~13:45 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **CEO** — pick the motion (services / audio-ML consulting / one consumer product); until then, heartbeats ship **sendable URLs + outbound**, not checkout plumbing |
| Distribution | **Shipped this beat** — [6cubed.app/#work](https://6cubed.app/#work) hire form above the fold; [blog: CARFAC underwater SAI](https://blog.6cubed.app/blog/carfac-underwater-sai) as the audio/ML proof URL; README Work with us |
| Ops | **OK** — edge smoke green; `int admin: OK (200)`; disk **64%** |

**Verify:** [6cubed.app](https://6cubed.app/#work) shows **Work with us** above the blog module; [blog post](https://blog.6cubed.app/blog/carfac-underwater-sai) **200**; a test hire email appears on [admin → Leads](https://admin.6cubed.app/leads).

**Open (CEO):** send the work URL or the CARFAC post to one real buyer this week.

---

## Recurring `216labs.db` "database disk image is malformed" — **CLOSED (root cause found)**

`216labs.db` is bind-mounted **as a single file** into `admin`, `cron-runner` and `activator`.
In **WAL** mode each container creates its own `-wal`/`-shm` sidecar **inside its own filesystem
layer**, so the three writers never see each other's locks or committed pages.

Observed live 2026-08-15: cron-runner holding a **4.8 MB private WAL**, admin a separate **342 KB**
one, against the same 2.6 MB file, plus a **stale host-side `-wal` from Aug 3**. Containers read the
DB fine; every **host** reader failed with `malformed`, which is what broke `deploy.sh` at
`export-env-admin-from-db.py`. This is the source of the `216labs.db.corrupt.*` snapshots dating to April.

| Why earlier fixes did not hold | Fix |
|---|---|
| May 2026 dropped the `-wal`/`-shm` compose mounts and set `journal_mode=DELETE` **on the DB** | `admin/src/lib/db.ts` and `cron-runner/index.js` still ran `pragma("journal_mode = WAL")` on **every container start**, silently reverting it |

**Shipped:** both now set `journal_mode = DELETE` (plus `busy_timeout`) with the reason in a comment.
Production recovered in place — `wal_checkpoint(TRUNCATE)` from the container that held the live WAL,
mode switched to DELETE, stale host sidecars moved to `/opt/216labs/_stale/`. No data lost
(`env_vars` 171, `apps` 72 before and after).

**Verify:** on the droplet `sqlite3 /opt/216labs/216labs.db "PRAGMA integrity_check; PRAGMA journal_mode;"`
→ `ok` / `delete`, and no `216labs.db-wal` appears next to it after containers restart.

---

## "First StoryMagic sale is blocked on the CEO's Payment Link" — **CLOSED (the premise was false)**

Every production snapshot from **2026-05-29 to 2026-08-15** named this as the top priority. It was wrong.

| Claim | Reality (measured 2026-08-15) |
|-------|-------------------------------|
| Sale is one Stripe Payment Link away | **4 human visitors in 30 days, 0 in the last 7**, across all 63 products; storybook had **0** ever |
| ~1.4k monthly edge uniques = traction | `edge_visitor_day` counted scanners hitting `/`, `/wp-admin`, `/.env` as visitors — a **360× overstatement** |
| Waitlist is warming up | `waitlistCount: 0`; `lead_event` table was never created, so no lead has ever existed |
| CEO is the blocker | Distribution is the blocker. A checkout converts a fraction of visitors; any fraction of 0 is 0 |

**Shipped this beat:** `edge-visitor-rollup` now classifies every visitor (`is_bot` + `bot_reason`:
`ua` / `scanner` / `no-assets`); admin Org metrics reports **Human visitors** with bots excluded;
`docs/REVENUE-STRATEGY.md` records the strategy; `heartbeat-monetization.mdc` now **forbids**
checkout plumbing as a monetization beat while human visitors are ~0.

**Verify:** [admin → Org metrics](https://admin.6cubed.app/org-metrics) shows **Human visitors (7d)**
with a bots-blocked sublabel; `./scripts/query_edge_uniques.sh landing 30` prints humans/bots/unclassified.

**Open (CEO):** pick the motion — **services**, **audio/ML consulting**, or **one consumer product**. See `docs/REVENUE-STRATEGY.md`.

---

## Production snapshot (2026-08-15 ~13:20 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of one product** | **CEO** — choose the motion (services / audio-ML consulting / one consumer product); see `docs/REVENUE-STRATEGY.md` |
| Metrics | **Shipped** — edge rollup now excludes bots; Org metrics reports human visitors (was inflated ~150× by scanners) |
| Ops | **Shipped** — `stack-health-check` internal admin probe no longer false-fails (see below); edge smoke green, disk **63%** |
| Research / DX | **Shipped** — [`colabs/carfac-sai-underwater`](../colabs/carfac-sai-underwater/) — CARFAC **SAI** vs mel vs NAP on Orcasound hydrophone audio, with a grouped-CV detection probe |

**Verify:** after the droplet picks up the new `cron-runner` image, `./scripts/heartbeat-stack.sh` shows `int admin: OK` (was `FAIL (timeout)`).

---

## Stack-health internal admin probe false negative — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `stack_health_last` → `int admin: FAIL (The operation was aborted due to timeout)` while `ext admin: OK (308)` and the app is fine | **Shipped** — internal probe moved from `http://admin:3000/` to `http://admin:3000/api/public/live-apps` |

The admin dashboard at `/` is `force-dynamic` and shells out to `docker ps` plus several HTTP fan-outs, so it blew past the probe timeout on a loaded droplet. `live-apps` is one SQLite read — the same endpoint `probeAdminResilient()` already uses, so the revenue probe reported admin healthy while stack-health reported it down.

Not cosmetic: `diagnosis` is computed from `intCoreOk` (admin + activator). With admin stuck false, a real Caddy outage would have been classified as generic `degraded` and pointed at `droplet-recover.sh` instead of `edge_proxy` → `droplet-spine-up.sh`.

**Rule of thumb, now in [`heartbeat-lights-on.mdc`](../.cursor/rules/heartbeat-lights-on.mdc):** internal probes must hit cheap endpoints, and an `int <svc>: FAIL` under a green edge gets investigated in that beat.

**Verify:** `./scripts/heartbeat-stack.sh` → `int admin: OK (200)`.

---

## CARFAC colab thread — **CLOSED (third notebook shipped 2026-08-15)**

| Notebook | Status |
|----------|--------|
| `colabs/carfac-vs-mel` (mel vs NAP) | **Shipped** |
| `colabs/carfac-sai-drone` (adds SAI, drone SAR audio) | **Shipped** |
| `colabs/carfac-sai-underwater` (SAI vs mel on hydrophone audio, detection probe) | **Shipped** — every cell executed against the real dataset on Python 3.12 before commit |

Underwater findings worth not re-deriving: mel **0.98** AUC, NAP **0.94**, time-averaged SAI **0.69**, SAI kept as **lag × time 0.82** — averaging the SAI over the decision window is what costs it. CARFAC's stock `min_pole_hz = 30` is wrong for water (ship rumble dominates the AGC); use a 150 Hz high-pass plus `min_pole_hz = 200`. Data is Orcasound Pod.Cast from `s3://acoustic-sandbox`, public, no credentials.

**Verify:** [Colab badge](https://colab.research.google.com/github/6cubed/216labs/blob/main/colabs/carfac-sai-underwater/experiment.ipynb) → Runtime → Run all; sections 1–3 in ~2 min, probe ~10–20 min.

---

## Production snapshot (2026-08-15 ~12:50 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → Stripe secret + **Create Payment Link** (still the only blocker; `revenue_env_last` issues 0, storybook checkout not ready) |
| Ops | **Shipped** — edge smoke green; disk **89% → 63%** via `prune-droplet-docker.sh`; lights-on rule now says to prune on the ≥88% WARN instead of waiting for a wedge |
| Research / DX | **Shipped** — [`colabs/carfac-sai-drone`](../colabs/carfac-sai-drone/) — CARFAC **stabilized auditory image** vs mel vs NAP on DroneAudioSet speech + distress-cry clips |

**Verify:** `./scripts/heartbeat-stack.sh` disk line **< 88%**; [Colab badge](https://colab.research.google.com/github/6cubed/216labs/blob/main/colabs/carfac-sai-drone/experiment.ipynb) returns **200** and the notebook runs ~2 min on CPU.

---

## CARFAC colab thread (earlier close-out) — **SUPERSEDED** by the entry above

| Item | Status |
|------|--------|
| `colabs/carfac-vs-mel` (mel vs NAP) | **Shipped** — on main |
| `colabs/carfac-sai-drone` (adds SAI, drone SAR audio) | **Shipped** — executed end to end on Python 3.11 before commit; both figures render |
| Audio source | DroneAudioSet samples via the authors' code repo (~52 MB), **not** the 23.5 h HF dataset (parquet shards ~120 MB each) |

Two gotchas worth keeping: CARFAC's AGC settling transient makes frame 0 the loudest SAI frame on
steady-noise clips (skip `SAI_WARMUP_S`), and `carfac.sai` puts zero lag at column
`sai_width - 1 - future_lags`, so frames need flipping for lag to read left-to-right.

**Verify:** Open the Colab badge in [`colabs/carfac-sai-drone/README.md`](../colabs/carfac-sai-drone/README.md); Runtime → Run all.

---

## Production snapshot (2026-08-03 ~19:05 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → Stripe secret + **Create Payment Link** (or paste Payment Link) |
| Ops | **OK** — edge smoke green; disk **57%**; `revenue_env_last` refreshed this beat |
| DX | **Shipped** — `./scripts/new-colab.sh` scaffolds `colabs/<id>` + index row; toolkit bootstrap + `colabs/carfac-vs-mel` already on main |

**Verify:** [admin](https://admin.6cubed.app/) **401**; `./scripts/new-colab.sh demo-probe "smoke?"` creates `colabs/demo-probe/` (delete if unused); StoryMagic `/api/checkout/ready` flips when Payment Link/keys land.

---

## Production snapshot (2026-08-03 ~18:50 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → **Create Payment Link** |
| Ops | **Shipped** — edge restored (Caddy auth); corrupt `216labs.db` restored from `bak.202606010218`; cron-runner healthy |
| Product | **Shipped** — KidGift waitlist social proof + GA4 (`waitlist_signup` / `preorder_click` / `storymagic_cta_click`) |
| DX | **Shipped** — Pocket Cursor bridge Glass UI (TipTap + sidebar agents); unmuted |

**Verify:** [admin](https://admin.6cubed.app/) **401**; [kidgift](https://kidgift.6cubed.app/) **200**; Telegram injects into mirrored Cursor chat after Glass restart.

---

## Telegram bridge silent / tab not found (Glass UI) — **CLOSED**

| Symptom | Fix |
|---------|-----|
| Bridge `.muted`; `chat scan (0)`; `ERROR: tab not found` | Glass Agents sidebar + TipTap composer selectors in `chat_detection.py` / `pocket_cursor.py`; remove `.muted`; restart bridge |

**Verify:** Bridge log shows `chat scan: … (N)` with N>0; Telegram message injects into active agent chat.

---

## Production snapshot (2026-06-01 ~04:54 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → **Create Payment Link** |
| Ops | **OK** — disk **56%**; `revenue_env_last` refreshed by heartbeat |
| DX | **Shipped** — edge uniques script self-diagnoses missing rollup table |

**Verify:** `./scripts/query_edge_uniques.sh storybook 7` → exit **2** + guidance on laptop; count on droplet DB.

---

## Production snapshot (2026-06-01 ~02:41 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → **Create Payment Link** |
| Product | **Shipped** — StoryMagic **hero waitlist** (above fold); `prune-droplet-docker.sh` aggressive prune when disk ≥88% |
| Ops | **Shipped** — aggressive prune freed disk **98% → 56%** (~11G); `prune-droplet-docker.sh` now auto-prunes at ≥88% |

**Verify:** [storybook.6cubed.app](https://storybook.6cubed.app) hero shows **Join waitlist** when no Payment Link; `df /` use% drops after prune.

---

## Edge uniques query “no such table” — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `./scripts/query_edge_uniques.sh <app> <days>` → `no such table: edge_visitor_day` | **Shipped** — script now detects missing table and prints the next move (rollup on droplet or `EDGE_UNIQUES_DB=...`). |

**Verify:** Run `./scripts/query_edge_uniques.sh storybook 7` on a laptop DB without rollup → exits **2** with guidance (not sqlite error). Point at a rollup DB → prints a number.

---

## Production snapshot (2026-05-31 ~22:06 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → **Create Payment Link** |
| Product | **Shipped** — admin **Leads** + **Checkout setup** surface 1Page €1 waitlist with urgency banner |
| Ops | **Watch** — droplet disk **~98%** (524M free) |

**Verify:** [admin Leads](https://admin.6cubed.app/leads) → **1PageResearch €1 checkout** section when signups exist.

---

## Production snapshot (2026-05-31 ~20:31 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → **Create Payment Link** |
| Product | **Shipped** — [1pageresearch.6cubed.app/generate](https://1pageresearch.6cubed.app/generate) **Notify me at launch** → admin Leads (`source_app_id=1pageresearch`) |
| Ops | **Watch** — droplet disk **~98%** (532M free) |

**Verify:** Generate page (no Stripe) → **Notify me at launch** → row on [admin Leads](https://admin.6cubed.app/leads).

---

## Production snapshot (2026-05-31 ~17:58 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → **Create Payment Link** |
| Product | **Shipped** — [kidgift.6cubed.app](https://kidgift.6cubed.app) results → StoryMagic waitlist (`utm_source=kidgift`, `results_waitlist`) |
| Ops | **Watch** — droplet disk **~98%** (533M free) |

**Verify:** KidGift → find gifts → **Join waitlist** → row on [admin Leads](https://admin.6cubed.app/leads) with campaign `gift_finder`.

---

## Production snapshot (2026-05-31 ~15:54 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → `STORYBOOK_STRIPE_SECRET_KEY` → **Create Payment Link** |
| Product | **Shipped** — [merch.6cubed.app](https://merch.6cubed.app) featured band + B2B link: live **Preorder** CTA when Payment Link is set (no merch redeploy) |
| Ops | **Watch** — droplet disk **~98%** after prune; CEO resize volume or remove unused images |

**Verify:** After Payment Link save, open merch → featured shows **Preorder live**; wholesale → [6cubed.app partnership form](https://6cubed.app/#storymagic-partners).

---

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

## StoryMagic preorder (Payment Link) — **SUPERSEDED (2026-08-15)**

Stripe Payment Link is **not** the blocker. See the top of this file and `docs/REVENUE-STRATEGY.md`: **8 human visitors in 6 weeks**, waitlist 0, leads 0. Checkout plumbing while humans ≈ 0 does not count as a monetization beat.

The product path still exists (Checkout setup → Payment Link) for when there is traffic. Do not reopen this thread as the top priority.

What was already shipped (kept so we do not rebuild it):

| Item | Status |
|------|--------|
| UI + hot-reload on save | **Shipped** — inline save on [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| One-click Payment Link | **Shipped** — when `STORYBOOK_STRIPE_SECRET_KEY` in Env → **Create Payment Link** on Checkout setup |
| Runtime URL on site | **Shipped** — client reads `preorderUrl` from `/api/checkout/ready` (no image rebuild after Env save) |
| Money | **Not the constraint** — set keys when humans > 0 |

---

## StoryMagic week experiment — **SUPERSEDED (2026-08-15)**

Same finding: a week experiment that starts with a Payment Link still needs strangers. Distribution first. `/experiment` remains available; do not treat it as the heartbeat default.

---

## Docs vs code (preorder / monitoring) — **CLOSED**

| Stale | Fix |
|-------|-----|
| `FIRST-SALE.md` / `REVENUE-ENV.md` implied keys-only; manifest omitted Payment Link | **Shipped** — docs + storybook manifest describe preorder + Checkout setup inline save |
| `revenue_env_last` hours old in heartbeat | Cron every 4h; heartbeat warns if **>2h**; refresh: `./scripts/run-droplet-cron.sh revenue-env-check` |

**Verify:** `./scripts/check-revenue-env-http.sh` documents preorder LIVE line; `./scripts/heartbeat-stack.sh` prints `storybook: preorder live` when configured.

---

## StoryMagic waitlist Telegram nudge — **CLOSED**

| Item | Status |
|------|--------|
| CEO ping when waitlist &gt;0 and no paid path | **Shipped** — `revenue-env-check` → `maybeStorymagicRevenueNudge` (12h cooldown) |

**Verify:** With waitlist rows and no preorder keys, next `revenue-env-check` posts to Telegram with Checkout setup link.

---

## Landing waitlist vs StoryMagic waitlistCount — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `waitlistCount: 0` while admin Leads had landing emails | **Shipped** — `POST /api/waitlist` on StoryMagic; 6cubed.app form writes `print_interest` (CORS) |
| API still `0` while `sqlite3` on volume showed rows | **Shipped** — lazy `DATA_DIR` + `/app/data` fallback, fresh readonly count in `countPrintInterests()`, `force-dynamic` on checkout/ready |

**Verify:** `curl -sS https://storybook.6cubed.app/api/checkout/ready` → `waitlistCount` matches `./scripts/query_storybook_waitlist_summary.sh`; [6cubed.app](https://6cubed.app) shows “N families on the waitlist” when N ≥ 1.

---

## KidGift launch — **CLOSED**

| Item | Status |
|------|--------|
| App | **Shipped** — [kidgift.6cubed.app](https://kidgift.6cubed.app) gift finder → StoryMagic upsell |
| Cold start | **Shipped** — `activator_never_evict` + edge-smoke `kidgift` probe (WARN when cold, not fail) |

**Verify:** `curl -sS https://kidgift.6cubed.app/healthz` → `{"ok":true,"service":"kidgift"}`; StoryMagic footer links KidGift.

---

## KidGift cold after showroom stop — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `edge-smoke` → `kidgift WARN cold/down HTTP 302` while StoryMagic funnel is live | **Shipped** — `kidgift` in revenue **hot pool** (`ACTIVATOR_PROTECTED_SERVICES`, `droplet-spine-up`, recover, showroom-stop, GHCR sync exclude) |

**Verify:** `curl -sS https://kidgift.6cubed.app/healthz` → `{"ok":true,"service":"kidgift"}`; `./scripts/edge-smoke.sh` → `kidgift OK`.

---

## Droplet disk pressure (~94%) — **CLOSED (mitigated 2026-06-01)**

| Symptom | Fix |
|---------|-----|
| Root **≥88–98%** full; light prune freed almost nothing | **Shipped** — `prune-droplet-docker.sh` runs `docker system prune -af` when disk ≥88%; freed **~11G** (98% → 56%) |
| Recurrence | **Watch** — `./scripts/heartbeat-stack.sh` disk line; optional `HEARTBEAT_AUTO_PRUNE_DISK=1`; DO volume resize if it climbs again |

**Verify:** `./scripts/heartbeat-stack.sh` → `=== Droplet disk ===` use% **&lt; 88%**; `./scripts/prune-droplet-docker.sh root@46.101.88.197` when CRITICAL.

---

## Production snapshot (2026-05-30 ~00:00 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — `STORYBOOK_STRIPE_SECRET_KEY` → [Checkout setup](https://admin.6cubed.app/checkout-setup) → **Create Payment Link** |
| Revenue product | **Shipped** — KidGift premium CTA switches to **Preorder** when StoryMagic `preorderUrl` is live (UTM `kidgift/preorder_cta`) |
| Ops | **Watch** — disk **~94%**; heartbeat now surfaces it every beat |

---

## Production snapshot (2026-05-29 ~22:55 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — `STORYBOOK_STRIPE_SECRET_KEY` → [Checkout setup](https://admin.6cubed.app/checkout-setup) → **Create Payment Link** |
| Ops | **Watch** — droplet disk **~94%**; prune via `./scripts/prune-droplet-docker.sh` if SSH flaps during recover |
| Product | **Shipped** — KidGift in revenue hot pool (spine/recover/activator protected) |

---

## Production snapshot (2026-05-29 ~20:48 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — `STORYBOOK_STRIPE_SECRET_KEY` → Overview **Create Payment Link** |
| Product | **Shipped** — KidGift live; StoryMagic ↔ KidGift cross-links; never-evict for funnel |

---

## Production snapshot (2026-05-29 ~15:31 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — `STORYBOOK_STRIPE_SECRET_KEY` → Overview **Create Payment Link** |
| Product | **Shipped** — StoryMagic footer → 6cubed B2B anchor; legacy partner leads recovered on admin Leads |

---

## Production snapshot (2026-05-29 ~14:00 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — `STORYBOOK_STRIPE_SECRET_KEY` → Overview or Checkout setup → **Create Payment Link** |
| Product | **Shipped** — B2B `storymagic_partner` kind preserved in leads API + dedicated section on admin Leads |

---

## StoryMagic B2B partner kind dropped — **CLOSED**

| Symptom | Fix |
|---------|-----|
| 6cubed.app partnership form sent `kind: storymagic_partner` but API coerced unknown kinds to `lead` | **Shipped** — allow `storymagic_partner` in `POST /api/public/leads`; admin Leads shows B2B section |

**Verify:** Submit partnership form on [6cubed.app](https://6cubed.app/) → [admin Leads](https://admin.6cubed.app/leads) shows row under **StoryMagic B2B** with kind `storymagic_partner`.

---

## Production snapshot (2026-05-29 ~11:59 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — `STORYBOOK_STRIPE_SECRET_KEY` → Overview or Checkout setup → **Create Payment Link** |
| Product | **Shipped** — one-click on admin Overview; B2B `storymagic_partner` leads on 6cubed.app; preorder UTMs include `book_id` |

---

## Production snapshot (2026-05-29 ~10:57 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — `STORYBOOK_STRIPE_SECRET_KEY` → [Checkout setup](https://admin.6cubed.app/checkout-setup) → **Create Payment Link** |
| Product | **Shipped** — Overview/Leads/Telegram `/firstsale` aligned to one-click path; production-only blast counts |

---

## Production snapshot (2026-05-29 ~09:56 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **CEO** — `STORYBOOK_STRIPE_SECRET_KEY` in Env → [Checkout setup](https://admin.6cubed.app/checkout-setup) → **Create Payment Link** (or paste link manually) |
| Product | **Shipped** — admin one-click Stripe Payment Link → saves preorder URL + hot-reload |

**Verify:** With `sk_test_…` in Env, Checkout setup → Create Payment Link → StoryMagic shows **Preorder now**; `./scripts/check-revenue-env-http.sh` → preorder LIVE.

---

## Production snapshot (2026-05-29 ~08:56 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — Payment Link on [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Product | **Shipped** — public `waitlistCount` excludes test emails; Payment Link URL warning on save; Web Share on preview |

---

## Production snapshot (2026-05-29 ~07:55 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — Stripe Payment Link → [Checkout setup](https://admin.6cubed.app/checkout-setup) → Save → [Leads blast](https://admin.6cubed.app/leads) |
| Product | **Shipped** — checkout-setup waitlist urgency + post-save blast nudge; landing share-after-waitlist |

---

## Production snapshot (2026-05-29 ~06:55 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — Payment Link on [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Product | **Shipped** — StoryMagic hero email-only waitlist (no AI gen); admin **Copy launch blast** on [Leads](https://admin.6cubed.app/leads) |

---

## Production snapshot (2026-05-29 ~06:25 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — Payment Link on [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Product | **Shipped** — landing waitlist social proof from live `waitlistCount`; docs aligned to `/api/waitlist` |

---

## StoryMagic week experiment (2026-05-29) — **SUPERSEDED**

See the 2026-08-15 entry at the top. Historical steps: `/experiment` then Payment Link then tracked URL. Do not treat as the current blocker.

---

## Production snapshot (2026-05-29 ~03:53 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Week experiment** | **You** — `/experiment` then Payment Link |
| Ops | **Shipped** — cron + heartbeat show StoryMagic waitlist count; Telegram `/experiment` |

---

## Production snapshot (2026-05-29 ~03:23 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Week experiment** | **You** — `./scripts/storymagic-week-experiment.sh` then Payment Link on Checkout setup |
| Product | **Shipped** — referral landing (`ref_book` banner + UTMs); week experiment launcher script |

---

## Production snapshot (2026-05-29 ~02:53 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **StoryMagic first sale** | **You** — Stripe Payment Link on [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Product | **Shipped** — admin Overview revenue next-step card; `./scripts/query_revenue_summary.sh`; `/checkout` summary |

**Closest live app:** StoryMagic — funnel + waitlist + UTMs shipped; **one Payment Link** unlocks preorder on StoryMagic, 6cubed.app, and waitlist blast.

---

## Production snapshot (2026-05-29 ~02:25 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — `/firstsale` → Payment Link on [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Ops | **Shipped** — merch warmup no longer false-fails revenue probe; FirstSaleBanner → Leads blast |

---

## Pocket bridge restart exit 143 — **CLOSED**

| Symptom | Fix |
|---------|-----|
| Bridge restart task exits **143** (SIGTERM) | Expected when a new `./scripts/pocket-cursor-bridge.sh` supersedes the prior process — not a crash if `pocket_cursor.py` is running afterward |

**Verify:** `pgrep -fl pocket_cursor.py` shows one process; Telegram `/status` responds.

---

## Merch catalog vs shippable SKUs — **CLOSED**

| Question | Answer |
|----------|--------|
| What merch is for sale? | **Designed catalog** at [merch.6cubed.app](https://merch.6cubed.app) (tees, hoodie, cap, stickers, tote, mug, socks) — Buy routes to StoryMagic until Printful URL is set |
| Is it cool? | Brand/copy/UI yes; **not shippable apparel** until `NEXT_PUBLIC_MERCH_STORE_URL` on Checkout setup |

**Verify:** Telegram `/merch` or [`docs/MERCH-FIRST-SALE.md`](MERCH-FIRST-SALE.md).

---

## Production snapshot (2026-05-29 ~01:55 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — Payment Link on [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Monetization | **Shipped** — landing preorder CTA when link live; admin **Copy preorder blast** on Leads |

---

## Production snapshot (2026-05-29 ~01:25 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — `/firstsale` → Payment Link on [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Product | **Shipped** — waitlist social proof on StoryMagic hero + preview; landing UTMs for attribution |

---

## Production snapshot (2026-05-29 ~00:44 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — `/firstsale` or [Checkout setup](https://admin.6cubed.app/checkout-setup) → Payment Link |
| Merch storefront | **You** — Printful URL on Checkout setup (`/merch` for catalog) |
| Ops | **Shipped** — merch probe false-positive fix; inline merch save on Checkout setup; Telegram `/merch` + `/firstsale` |

---

## Merch revenue probe false positive — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `[Merch] storefront URL appears configured` while Buy still routes to StoryMagic (or activator warmup HTML) | **Shipped** — probes match `Shop via StoryMagic`, warmup page, and positive catalog markers |

**Verify:** `./scripts/check-revenue-env-http.sh` → `[Merch] … not active` until Printful URL saved; `./scripts/query_merch_summary.sh` → `fallback` vs `live`.

---

## Production snapshot (2026-05-28 ~23:45 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — run [`STORYMAGIC-WEEK-EXPERIMENT.md`](STORYMAGIC-WEEK-EXPERIMENT.md) (Payment Link first) |
| Product | **Shipped** — week experiment doc; OG $24.99 copy; `./scripts/open-first-sale.sh` → Payment Links |

---

## Production snapshot (2026-05-28 ~23:15 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — Payment Link on [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Product | **Shipped** — post-waitlist preorder upsell; admin waitlist CSV export |

---

## Production snapshot (2026-05-28 ~22:15 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup) → create [Payment Link](https://dashboard.stripe.com/test/payment-links/create) |
| Product | **Shipped** — form + hero preorder CTAs; UTMs pass through to Stripe link |

---

## Production snapshot (2026-05-28 ~21:55 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| DX | **Shipped** — `/waitlist` + `query_storybook_waitlist_summary.sh`; Leads page paid-path banner |

---

## Production snapshot (2026-05-28 ~21:25 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Ops | **Shipped** — Telegram auto-nudge when waitlist exists without payment path |

---

## Production snapshot (2026-05-28 ~20:50 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup) (waitlist count shown when &gt;0) |
| Ops | **Shipped** — Telegram `/revenue` alias; checkout-setup waitlist urgency card |

---

## Production snapshot (2026-05-28 ~20:20 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **First StoryMagic sale** | **You** — [Checkout setup](https://admin.6cubed.app/checkout-setup) |
| Docs / monitoring | **Shipped** — revenue docs aligned with code; heartbeat stale threshold 2h |

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
