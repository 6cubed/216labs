# Thread close-outs (heartbeat log)

Decisive end states for recurring Telegram/chat threads so the next session does not re-litigate them.

**How to read this file:** the **latest production snapshot at the top** is canonical. Do not revive **SUPERSEDED** or **CLOSED** threads. Older "BLOCKED (CEO) — Payment Link" rows below are historical; distribution is the constraint, not Stripe.

## Production snapshot (2026-08-16 ~05:45 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Heartbeat process | **Shipped** — 302 on human host ≠ 302 on agitweet; harness-self-edit counts as the Push |
| Edge | **OK** — three human hosts 200; hot pool only Anchor + Zurich |

**Verify:** `heartbeat_harness.json` closeouts text contains **href AND fetch**. Public hosts unchanged this beat (no landing restyle). CEO: send `/work`.

---

## Closeouts forced a landing restyle every 30 minutes — **CLOSED**

Today’s friction was process: “if hosts 200, ship visitor-facing” plus “302 until dest 200” made agents churn hire-adjacent HTML and miss leftover `fetch()` after dropping an href.

**Shipped:** harness + monetization + pocket-cursor: sibling 302 = strip all references (do not start); harness-self-edit Reflect counts as the Push. Did not restyle landing. Did not start agitweet.

**Verify:** next harness-self-edit beat does not docker-cp landing unless a leftover href/fetch remains.

---

## Production snapshot (2026-08-16 ~05:15 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Landing JS still woke Agitweet | **Shipped** — removed `/api/posts` fetch; static pin only |
| Edge / hot pool | **OK** — only `anchor-api` + `zurichrunclubs` evictable |

**Verify:** `curl -sS https://6cubed.app/` has no `agitweet.6cubed.app/api/posts`. CEO: send `/work`.

---

## Homepage fetch still started Agitweet — **CLOSED**

Highest-leverage unfinished item is still CEO `/work`. Last beat dropped the Open Agitweet href but left `fetch(agitweet…/api/posts)`, which 302s to activator on every homepage load.

**Shipped:** removed the fetch. Did not restyle the hire pin. Did not start agitweet.

**Verify:** public homepage HTML contains no `agitweet.6cubed.app`.

---

## Production snapshot (2026-08-16 ~04:45 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| LRU vs human hosts | **Shipped** — Anchor + Zurich `activator_never_evict`; nonessential extras stopped |
| Homepage Open Agitweet | **Shipped** — dropped (was 302); did not start agitweet |

**Verify:** `curl -sS https://6cubed.app/` has no `Open Agitweet`. Hot pool after sync is only human-visited (+ spine). CEO: send `/work`.

---

## Bot-woken extras could LRU-evict the hosts that had humans — **CLOSED**

Hot pool was at cap 6 including aiart/pocket/tortellini/vc. Anchor and Zurich were evictable. Homepage “Open Agitweet →” still 302ed.

**Shipped:** `activator_never_evict` on both human hosts; `stop-nonessential-compose-apps.sh` on GHCR sync; dropped the Agitweet href. Did not restyle `#work`. Did not start agitweet.

**Verify:** public homepage has no `agitweet.6cubed.app?utm_source=landing`. Manifests contain `activator_never_evict`.

---

## Production snapshot (2026-08-16 ~04:15 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Homepage Live apps | **Shipped** — always-200 allowlist only (was the enabled catalogue → 302) |
| Closest to charging | Hire/CARFAC, not Storybook checkout (`checkout not ready` is not the blocker) |

**Verify:** `curl -sS https://6cubed.app/` contains `zurichrunclubs` and does **not** contain `birdperch.6cubed.app` or `bugbounty.6cubed.app`. CEO: send `/work`.

---

## Live-apps catalogue converted humans into warmup — **CLOSED**

Admin `GET /api/public/live-apps` is every `deploy_enabled=1` row. The homepage listed ~20 cold hosts (blog, birdperch, aiart, …). Closest to charging is still hire/CARFAC; Storybook checkout does not count while humans ≈ 0.

**Shipped:** landing filters to anchor, zurichrunclubs, storybook, kidgift, 1pageresearch, maxlearn. Dropped footer bugbounty 302. Did not start those apps. Did not restyle `#work`.

**Verify:** public homepage HTML has `anchor.6cubed.app` and no `birdperch.6cubed.app`.

---

## Production snapshot (2026-08-16 ~03:45 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Landing “All posts on blog” | **Shipped** — index is GitHub colabs, not cold `blog.6cubed.app` |
| Hot pool assumption | **Corrected** — `anchor-api` / `zurichrunclubs` are human-visited, not bot-woken |

**Verify:** `curl -sS https://6cubed.app/` contains `All notebooks on GitHub` and does **not** contain `All posts on blog.6cubed.app`. CEO: send `/work`.

---

## “Latest from the blog” still dumped visitors on activator — **CLOSED**

Fallback cards were already GitHub; the section footer still said **All posts on blog.6cubed.app** (302). Hot-pool copy treated human-visited hosts as bot-woken.

**Shipped:** landing section → Latest writing / GitHub colabs. Stack hot pool splits human-visited vs other. Did not start blog or agitweet. Did not restyle `#work`.

**Verify:** public homepage HTML contains `colabs/README.md` in the writing footer.

---

## Production snapshot (2026-08-16 ~03:15 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Anchor empty Zurich feed | **Shipped** — empty copy + `/api/v1/posts/recent` fallback |
| Observability | **Shipped** — `heartbeat-stack` prints evictable hot pool (pocket/tortellini/vc were bot-woken) |

**Verify:** `curl -sS https://anchor.6cubed.app/` contains **No notes within 5 km**. `./scripts/heartbeat-stack.sh` prints `Evictable hot pool`. CEO: send `/work`.

---

## Heartbeat-stack hid bot-woken apps; Anchor feed was a blank page — **CLOSED**

Lights-on looked empty while pocket, tortellini, and vc were running (deploy_enabled=1, bot hits). Zurich nearby API returned `[]`.

**Shipped:** hot-pool line on heartbeat-stack; Anchor empty-state + `/recent`. Did not start agitweet. Did not add a hire CTA.

**Verify:** public Anchor HTML contains `No notes within 5 km`. Stack output contains `Evictable hot pool`.

---

## Production snapshot (2026-08-16 ~02:45 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Stranger → lead without CEO | **Shipped** — GitHub [paid-pilot issue](https://github.com/6cubed/216labs/issues/new?template=paid-pilot.yml) |
| Landing dead shop/blog cards | **Shipped** — dropped merch/marketing (302); fallback cards are GitHub-only |

**Verify:** issue form **200**. `curl -sS https://6cubed.app/` has `CARFAC-PILOTS.md` and does **not** contain `merch.6cubed.app`. CEO: send `/work`.

---

## Smallest revenue diff was a GitHub form, not another landing CTA — **CLOSED**

Lead API already works (CORS 204 / 400). Merch and marketing 302 from the shop. Repo had no issue template and `gh` is unauthenticated (topics stay empty).

**Shipped:** `.github/ISSUE_TEMPLATE/paid-pilot.yml`; landing shop drops cold merch/marketing; blog fallback cards 2–3 → GitHub offer + colabs index. Did not start merch, blog, or agitweet.

**Verify:** [new paid-pilot issue](https://github.com/6cubed/216labs/issues/new?template=paid-pilot.yml) shows Work email + domain. Public homepage HTML contains `docs/CARFAC-PILOTS.md`.

---

## Production snapshot (2026-08-16 ~02:15 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Audio/ML proof dest | **Shipped** — landing + GitHub offer sheet point at the colab README (always 200), not cold `blog.6cubed.app` |
| Edge | **OK** — three human hosts 200; agitweet `/api/posts` 302 left cold |

**Verify:** `curl -sS https://6cubed.app/` contains `colabs/carfac-sai-underwater`. GitHub underwater README **200**. CEO: send `/work`.

---

## Landing Audio/ML proof dumped strangers on activator — **CLOSED**

`blog.6cubed.app/blog/carfac-underwater-sai` is 302 whenever the blog is cold. Starting blog to “verify” the offer wastes RAM and contradicts the agitweet rule.

**Shipped:** proof href on landing (and the cold-blog fallback card) → GitHub `colabs/carfac-sai-underwater/README.md`. Did not start blog or agitweet. Did not restyle `#work` copy.

**Verify:** public `https://6cubed.app/` HTML contains `github.com/6cubed/216labs/blob/main/colabs/carfac-sai-underwater`.

---

## Production snapshot (2026-08-16 ~01:45 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Distribution without CEO | **Shipped** — hire/CARFAC on Colab index + live Anchor footer (Agitweet hire already id=88) |
| Edge | **OK** — last GHCR sync skipped Caddy recreate |

**Verify:** `curl -sS https://anchor.6cubed.app/` contains `paid work / CARFAC`. GitHub `colabs/README.md` contains `6cubed.app/#work`. CEO: send `/work`.

---

## Monetization beat opened Storybook checkout — **CLOSED**

Closest to charging while humans ≈ 0 is hire/CARFAC, not `storybook: checkout not ready`. Agitweet already has the hire post; public `/api/posts` 302s because the app is cold.

**Shipped:** Colab index CTA; Anchor footer link to `#work`. Did not start agitweet. Did not restyle landing.

**Verify:** Anchor HTML contains `CARFAC`; colabs README contains `#work`.

---

## Production snapshot (2026-08-16 ~01:15 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Edge `edge_proxy` | **Shipped** — Caddy is recreated only when the Caddyfile changes (was every GHCR sync) |
| Anchor | **Live** — feed still 200; denied location falls back to Zurich |

**Verify:** next `droplet-ghcr-sync` log contains `Caddyfile unchanged — skip recreate`. `curl -sS https://anchor.6cubed.app/` contains **Showing Zurich**. CEO: send `/work`.

---

## Periodic GHCR sync took the public edge down — **CLOSED**

Cron `edge_proxy` / ECONNREFUSED `:80` while admin/activator were 200: `droplet-ghcr-sync` and `ensure-spine` force-recreated Caddy on every 20-minute tick (and twice per tick). Recover then flapped SSH.

**Shipped:** `scripts/lib/recreate-caddy-if-caddyfile-changed.sh`; Anchor Zurich fallback when geolocation is denied.

**Verify:** Caddy stays up across a no-op sync; Anchor HTML contains `Showing Zurich`.

---

## Production snapshot (2026-08-16 ~00:45 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| `anchor.6cubed.app` | **Shipped** — homepage is a nearby-post feed (geolocation + post), not API-docs-only |
| zurichrunclubs / landing | **OK** — 200 / 200 |

**Verify:** `curl -sS https://anchor.6cubed.app/` contains **Share location** (or “nearby”) and not only `API docs`. CEO: send `/work`.

---

## Anchor homepage was docs-only for returning humans — **CLOSED**

Tied 2nd for visitors, 200, but the page only linked `/docs` and `/health`. Flutter web is still off GHCR.

**Shipped:** HTML feed that registers a device, lists posts in 5 km, and accepts a post. Live after `docker cp` + restart; GHCR on next always-include publish.

**Verify:** public `/` contains `Share location to see what’s nearby`.

---

## Production snapshot (2026-08-16 ~00:15 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| `zurichrunclubs.6cubed.app` | **Live** — GHCR 2026-08-15 image; Next `/` is real clubs (no Caddy rewrite) |
| Anchor | **OK** — 200 from GHCR image (not docker cp) |

**Verify:** `curl -sS https://zurichrunclubs.6cubed.app/` is ~60k HTML with **CityRunning Nord**, not the 9k static snapshot. CEO: send `/work`.

---

## Targeted GHCR pull synced the wrong app — **CLOSED**

`SYNC_SERVICE=zurichrunclubs` pulled **anchor-api** (first non-excluded running service) then `break`, so the August timetable image never replaced the May container. Admin “Pull latest” had the same bug.

**Shipped:** `droplet-ghcr-sync.sh` skips every other running service when `SYNC_SERVICE` is set; pulled `zurichrunclubs`; removed the Caddy `/` → `/timetable.html` rewrite now that native Next has the clubs.

**Verify:** public `/` length is tens of KB (Next grid), contains CityRunning, not `src/data/clubs.ts`.

---

## Production snapshot (2026-08-15 ~23:45 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| `zurichrunclubs.6cubed.app` | **Live** — `/` 302s to `/timetable.html` with real clubs (WERUN, 6:ZH, CityRunning, …). GHCR `:latest` is still 2026-05-29; sync excludes this app |
| Anchor / landing | **OK** — both **200** |

**Verify:** `curl -sS https://zurichrunclubs.6cubed.app/` contains **CityRunning Nord** and not **Zurich Run Collective**. CEO: send `/work`.

---

## Last beat’s club list never reached visitors — **CLOSED**

`0b3ce0ce` was on `main` but GHCR `:latest` is still the May image, and `droplet-ghcr-sync` **excludes** `zurichrunclubs`. Curl of `/` still showed invented names. A turbopack chunk patch 500’d; restored via compose recreate.

**Shipped:** static `public/timetable.html` in the running container + Caddy rewrite of exact `/` to that file; `zurichrunclubs` on `ghcr-always-include.txt`. Do not local-build.

**Verify:** public `/` 200 with CityRunning; `/timetable.html` 200.

---

## Production snapshot (2026-08-15 ~23:15 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| `zurichrunclubs.6cubed.app` | **Shipped** — timetable is real drop-in clubs (WERUN, 6:ZH, CityRunning, On Lab, District, ZH3, FRC) with Meetup/store permalinks; curator `src/data/clubs.ts` note removed |
| Anchor / landing | **OK** — both **200**; leftovers still stopped |

**Verify:** public `/` lists **CityRunning Nord** (not “Zurich Run Collective”) and does **not** mention `src/data/clubs.ts`. Live after GHCR sync of `zurichrunclubs`. CEO: send `/work`.

---

## Fake clubs on the only geo host that had humans — **CLOSED**

The page that already had visitors told people to edit `src/data/clubs.ts` and linked Instagram hashtag searches for invented names. Edge was 200; the product was still a placeholder.

**Shipped:** replace rows with recurring Zurich groups and permalinks; add Strava/ASVZ “announced each week”.

**Verify:** `curl -sS https://zurichrunclubs.6cubed.app/` contains `CityRunning` and not `Zurich Run Collective`.

---

## Production snapshot (2026-08-15 ~22:40 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| `anchor.6cubed.app` | **Live** — FastAPI HTML `/` is **200** (was 502, then empty 302/404) |
| GHCR | **Shipped** — `anchor-api` is always-include so the homepage does not depend on a one-off `docker cp` |

**Verify:** `curl -sS https://anchor.6cubed.app/` contains `Anchor` and is not a 302 to activator.

---

## Anchor warmup 302 was not a finished ship — **CLOSED**

Caddy reached a stale GHCR image with no `GET /`, so the public host 404'd after start. The HTML from 7634c51f was copied into the running container; `config/ghcr-always-include.txt` now lists `anchor-api`.

**Verify:** public `/` 200 with `<h1>Anchor</h1>`; zurichrunclubs still 200.

---

## Production snapshot (2026-08-15 ~22:10 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Disabled leftovers returning on GHCR sync | **Shipped** — `stop-disabled-compose-apps.sh` on pressure / spine / recover (skips protected spine) |
| Anchor / zurichrunclubs / landing | **OK** — 302 warmup / 200 / 200 |

**Verify:** next `droplet-ghcr-sync` log contains `stop-disabled`; `valentine` stays stopped.

---

## GHCR sync would restart disabled leftovers — **CLOSED**

Stopping valentine/tldrtech/workforce by hand did not compound: `restart: unless-stopped` plus a later compose up puts them back in the LRU cap. Pressure/spine scripts never looked at `deploy_enabled`.

**Shipped:** `scripts/stop-disabled-compose-apps.sh` (cron-runner sqlite, skip protected). Wired into resource-pressure, ensure-spine, recover.

**Verify:** script prints `stopped 0 leftover(s)` while those three are down; does not stop storybook/1pageresearch (protected, even if `deploy_enabled=0`).

---

## Production snapshot (2026-08-15 ~21:40 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Anchor still 302 | **Cause** — LRU cap (10) was full of leftover **disabled** containers; no room to pull `anchor-api` |
| Disabled apps occupying RAM | **Shipped** — stop `deploy_enabled=0` leftovers; reaper evicts them first |

**Verify:** `valentine`, `tldrtech`, `workforce` are not in `docker compose ps` (running). `curl -I https://anchor.6cubed.app` still 302 until the next warmup pull; zurichrunclubs stays 200.

---

## Disabled apps filled the activator LRU cap — **CLOSED**

`valentine` / `tldrtech` / `workforce` are `deploy_enabled=0` but were still running (`restart: unless-stopped`). Evictable count sat at the cap of 10, so a returning human on `anchor.6cubed.app` could not cold-start without evicting something else (including zurichrunclubs).

**Shipped:** stop those three now; activator reaper evicts `deploy_enabled=0` before LRU.

**Verify:** those three services are stopped; `free -m` available rises.

---

## Production snapshot (2026-08-15 ~21:10 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Audio/ML B2B path | **Shipped** — CARFAC Colabs + READMEs now link the [pilot offer](CARFAC-PILOTS.md) and `#work` |
| Anchor / landing / zurichrunclubs | **OK** — 302 warmup / 200 / 200; no new 502s |

**Verify:** GitHub `colabs/carfac-sai-underwater/README.md` contains `6cubed.app/#work`. Colab intro cells include **Paid detection pilots**.

---

## Monetization beats were told to ship checkout while humans ≈ 0 — **CLOSED**

The ~1-in-10 reflect line listed "checkout, subscribe, merch" first. That contradicts `heartbeat-monetization.mdc` and produces Stripe work instead of a stranger-facing offer.

**Shipped:** reflect line + `monetization_reflect_note` now say distribution/B2B while visitors are ~0. CARFAC Colabs (indexed, no deploy) carry the paid-pilot CTA.

**Verify:** next monetization beat does not open Stripe keys.

---

## Production snapshot (2026-08-15 ~20:40 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| `anchor.6cubed.app` 502 | **Shipped** — Caddy now warms up FastAPI instead of dead `anchor-web` (not on GHCR) |
| Agitweet hire | **Live in volume** — id=88; do not start a cold agitweet |

**Verify:** `curl -I https://anchor.6cubed.app` is **302** to activator (not 502). HTML `/` lands after GHCR has the new `anchor-api` image.

---

## Anchor 502'd because Caddy still proxied Flutter web — **CLOSED**

`anchor` had 10 human visitors (tied 2nd in the portfolio) and returned empty 502: no `anchor-web` image on the droplet, and GHCR skips that service. The hardcoded Caddy block had no activator fallback.

**Shipped:** generate-caddyfile routes `anchor.6cubed.app` to `anchor-api:8000` with the same 502→warmup path as other apps; FastAPI serves `/`. Recreate **caddy** after git pull (reload is a stale inode).

**Verify:** Location on a cold hit contains `warmup?app=anchor`.

---

## Production snapshot (2026-08-15 ~20:10 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Reach a stranger without the CEO | **Live in volume** — hire is agitweet **id=88**; public `/api/posts` 302s because the app is cold |
| Harness | **Shipped** — 302 to activator ≠ missing hire; do not start agitweet to re-check |

**Verify:** `./scripts/post_hire_agitweet.sh` prints `already posted id=88 (volume; not starting agitweet)` while `curl -I https://agitweet.6cubed.app/api/posts` is 302.

---

## Public `/api/posts` 302 would wake Agitweet every heartbeat — **CLOSED**

`urlopen` follows activator warmup, JSON parse fails, and the script treated that as “not posted” then `--force-recreate`. Hire was already in `products/org-social/agitweet/data/agitweet.db`.

**Shipped:** no-follow-redirect public check; volume sqlite is source of truth; cold app is not started.

**Verify:** script skip line above; homepage still contains `Pinned — hire`.

---

## Production snapshot (2026-08-15 ~19:45 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Reach a stranger without the CEO | **Live** — Agitweet post **id=88** has the hire + CARFAC URLs |
| Harness | **Shipped** — skip re-post / agitweet recreate when `/api/posts` already shows `#work` |

**Verify:** `curl -sS https://agitweet.6cubed.app/api/posts?limit=1` text includes `6cubed.app/#work`. Do not run `post_hire_agitweet.sh` again unless that is gone.

---

## Nested `python -c` in `docker compose exec` ate the hire POST — **CLOSED**

`scripts/post_hire_agitweet.sh` claimed a post; nested bash-heredoc `python -c` printed nothing. Working path: droplet Python reads `AGITWEET_API_TOKEN` from sqlite and pipes `token\\n{json}` into `compose exec -T`.

**Shipped:** stdin post; script is idempotent (skip if recent post has `#work`; recreate only if token/health missing).

**Verify:** public `/api/posts` id=88; rerunning the script prints `already posted id=88` and does not recreate.

---

## Production snapshot (2026-08-15 ~19:40 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` still the send; do not restyle the funnel |
| Reach a stranger without the CEO | **Shipped** — `scripts/post_hire_agitweet.sh` posts the hire blurb to Agitweet (no landing deploy) |
| Harness | **Shipped** — Push bar: no local image deploy while CEO-blocked unless edge is down |

**Verify:** [agitweet.6cubed.app](https://agitweet.6cubed.app) shows the hire/CARFAC post (warmup may 302 first).

---

## Heartbeats waited out SSH to restyle hire HTML — **CLOSED**

The Push bar did not say “skip image transfer when CEO-blocked.” Agents spent a beat on `deploy.sh` flaps to pin hire copy. Closeouts already forbade funnel restyles.

**Shipped:** `execution_floor` line + Agitweet post script.

**Verify:** next CEO-blocked beat does not start `DEPLOY_IMAGE_SOURCE=local` unless edge is down.

---

## Production snapshot (2026-08-15 ~19:10 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **BLOCKED (CEO)** — `/work` is live; send [6cubed.app/#work](https://6cubed.app/#work) to one buyer. Do not restyle this funnel until that happens. |
| Homepage Agitweet module | **Shipped** — pinned hire blurb when agitweet is cold (was “Loading…” / fetch error) |
| Harness | **Shipped** — closeouts text forbids a third hire-funnel restyle while the CEO row is unchanged |

**Verify:** [6cubed.app](https://6cubed.app/) Agitweet section shows the pinned hire text without JS.

---

## Homepage Agitweet died when the app was cold — **CLOSED**

`/api/posts` bypasses warmup, so the landing fetch 502s and the module looked empty. Same class of bug as the cold blog feed.

**Shipped:** server-rendered pinned hire card; live posts replace it when agitweet is warm.

**Verify:** homepage HTML contains `Pinned — hire` and `6cubed.app/#work`.

---

## Production snapshot (2026-08-15 ~18:40 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **CEO** — Telegram `/work`; send [6cubed.app/#work](https://6cubed.app/#work) or the CARFAC post (warmup now returns to the article, not the blog index) |
| Cold-start deep links | **Shipped** — Caddy warmup `dest` keeps `{http.request.uri.path}` |
| Homepage CARFAC card | **Live** (prior beat) |

**Verify:** `curl -I https://blog.6cubed.app/blog/carfac-underwater-sai` Location includes `/blog/carfac-underwater-sai` when blog is cold.

---

## Activator warmup dropped the article path — **CLOSED**

A cold `blog.6cubed.app/blog/carfac-underwater-sai` 302ed to warmup with `dest=https://blog.6cubed.app`. After start, the buyer landed on the index. Activator already allowed paths; Caddy never passed them.

**Shipped:** `scripts/generate-caddyfile.py` appends `{http.request.uri.path}` to dest.

**Verify:** Location header on a cold deep link contains the original path.

---

## Production snapshot (2026-08-15 ~18:10 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **CEO** — Telegram `/work`; send [6cubed.app/#work](https://6cubed.app/#work) (homepage now always lists the CARFAC post even when blog is cold) |
| Homepage blog module empty | **Shipped** — landing pins CARFAC + two posts when `blog:3000/api/feed` is down (activator warmup HTML is not JSON) |
| Ops | **OK** — do not revive WAL / Payment Link / deploy-tar threads |

**Verify:** [6cubed.app](https://6cubed.app/) “Latest from the blog” shows the CARFAC title while `https://blog.6cubed.app/api/feed` still 302s to activator.

---

## Homepage hid the CARFAC proof while blog was cold — **CLOSED**

The hire form’s proof URL lived in a blog feed that goes empty whenever the blog container is stopped. Public `/api/feed` 302s to activator HTML, so urllib cannot parse it. Visitors saw “Blog feed loads when the blog service is reachable.”

**Shipped:** static fallback posts on landing, CARFAC first.

**Verify:** homepage lists CARFAC without waiting for blog warmup.

---

## Production snapshot (2026-08-15 ~17:40 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **CEO** — Telegram `/work`; send [6cubed.app/#work](https://6cubed.app/#work) or the [CARFAC post](https://blog.6cubed.app/blog/carfac-underwater-sai) to one buyer |
| Local deploy SSH flap | **Shipped** — `deploy.sh` splits scp / `docker load -i`, long-waits SSH, keeps gzip tars on failure |
| Admin Overview | **Live** — hire CTA (prior beat) |

**Verify:** next `DEPLOY_IMAGE_SOURCE=local` run either loads the image after a flap or prints `Keeping gzip tars in /tmp/216labs-xfer.*` instead of deleting them.

---

## `deploy.sh` deleted gzip tars after 6 SSH flaps — **CLOSED**

2026-08-15 ~17:21: local admin transfer failed `attempt 6/6`, then SSH was up 0s later. The script had already `rm -rf` the 86MB gzip, so the follow-up had to `docker save` again.

**Shipped:** wait between scp and load; 5-minute extra SSH wait; keep tars on failure.

**Verify:** failure path prints the tar directory; success path still `docker load -i`.

---

## Production snapshot (2026-08-15 ~17:10 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **CEO** — Telegram `/work`; send [6cubed.app/#work](https://6cubed.app/#work) or the [CARFAC post](https://blog.6cubed.app/blog/carfac-underwater-sai) to one buyer |
| Admin Overview CTA | **Shipped** — banner + next-step card match `/work`, not Payment Link, while waitlist is 0 |
| Ops | **OK** — do not revive WAL / Payment Link threads |

**Verify:** [admin.6cubed.app](https://admin.6cubed.app/) shows **First euro — send /work**; Checkout setup amber dot is off until waitlist > 0.

---

## Admin Overview still taught Payment Link — **CLOSED**

Telegram `/work` was already the outbound tool, but every admin page load still said “create a Stripe Payment Link.” That undoes the CEO’s muscle memory.

**Shipped:** `FirstSaleBanner` + `RevenueNextStepCard` hire-first; nav amber-dot only when waitlist has demand.

**Verify:** Overview hire CTA; `/checkout-setup` still exists for when there is traffic.

---

## Production snapshot (2026-08-15 ~16:45 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **CEO** — Telegram `/work` (alias `/firstsale`) forwards the hire blurb; send [6cubed.app/#work](https://6cubed.app/#work) or the [CARFAC post](https://blog.6cubed.app/blog/carfac-underwater-sai) to one buyer |
| Telegram muscle memory | **Shipped** — `/firstsale` no longer asks for a Stripe Payment Link; same card as `/work` |
| Ops | **OK** — do not revive WAL/Payment Link threads; latest prior snapshot ~15:00 UTC still holds |

**Verify:** in Telegram, `/work` prints the hire blurb with those two URLs; `./scripts/query_first_sale_steps.sh` matches.

---

## `/firstsale` still taught Payment Link — **CLOSED**

Telegram `/firstsale` and `scripts/query_first_sale_steps.sh` still told the CEO to create a Stripe Payment Link after strategy already named distribution as the constraint. That wasted the CEO's highest-leverage minutes.

**Shipped:** `/work` + `/outreach`; `/firstsale` aliases them; `/now` leads with hire links.

**Verify:** `/work` in Telegram; do not restore Payment Link copy to `/firstsale` while humans ≈ 0.

---

## Production snapshot (2026-08-15 ~15:00 UTC)

| Highest leverage | Blocker |
|------------------|---------|
| **Get one human in front of a paid offer** | **CEO** — send [6cubed.app/#work](https://6cubed.app/#work) or the [CARFAC post](https://blog.6cubed.app/blog/carfac-underwater-sai) to one buyer |
| Ops | **Shipped** — `live-apps` is a cheap SELECT; activator+cron-runner both force `journal_mode=DELETE`; `deploy.sh` copies a gzip tar and does **not** prune on every transfer |
| Distribution | **Live** — work form + CARFAC proof URL |

**Verify:** `./scripts/heartbeat-stack.sh` → `int admin: OK (200)`; on the droplet, cron-runner `PRAGMA journal_mode` is `delete` and `integrity_check` is `ok`.

---

## `int admin: FAIL (HTTP 500)` / WAL flip-flop — **CLOSED**

| Symptom | Fix |
|---------|-----|
| Stack-health `int admin: FAIL (HTTP 500)` while edge `live-apps` sometimes 200 | Probe was **writing** (project sync) on every GET → `SQLITE_BUSY`. Now a read-only SELECT, no sync on worker start, retries + last-good cache. |
| `PRAGMA journal_mode` kept returning **wal** after admin/cron-runner were switched to DELETE | **Activator** never set DELETE. Old **cron-runner** image (2026-08-03) still ran `journal_mode = WAL` on every start. Both images rolled this beat. |
| Host `PRAGMA journal_mode=DELETE` while containers were up | **Do not.** Private WAL sidecars + a host-side mode change → `SQLITE_CORRUPT` → cron-runner crash loop → sshd `connection refused`. Recover: reboot, then change mode **from inside** a writer container. |

**Verify:** `int admin: OK (200)`; `journal_mode=delete`; cron-runner not restarting.

---

## Piped local image transfer kills SSH — **CLOSED**

| Symptom | Fix |
|---------|-----|
| `ssh: connection refused` during `DEPLOY_IMAGE_SOURCE=local` while edge still 200 | **Shipped** — gzip tar + scp + `docker load` from disk. Do **not** `docker prune` on every transfer (1GB RAM); prune only at disk ≥88%. |

**Verify:** next local deploy prints `gzip file, sequential` and does not print `Pruning dangling images` unless disk is critical.

---

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
