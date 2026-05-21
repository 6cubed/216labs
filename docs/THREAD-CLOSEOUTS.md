# Thread close-outs (heartbeat log)

Decisive end states for recurring Telegram/chat threads so the next session does not re-litigate them.

## MaxLearn — “can’t access” (2026-05-20)

| Item | Status |
|------|--------|
| Empty `data/` volume (0 snippets) | **Fixed** — `bootstrap_seed_if_empty` + `seed_if_empty.py` before gunicorn (`ac4def64`+, startup seed hardened this doc cycle) |
| Activator cold / LRU eviction | **Mitigated** — `activator_never_evict`, `deploy-bootstrap.txt` |
| Deploy | Run `docker compose up -d --force-recreate maxlearn` after pull; first start may take ~30s while Wikipedia seed runs |

**Verify:** `curl https://maxlearn.6cubed.app/api/seed-status` → `seed_snippets` ≥ 20 and `ready: true`; `curl https://maxlearn.6cubed.app/api/next` returns a snippet. Optional bulk seed: `python seed_wikipedia.py` on droplet (10k target).

**Root cause if still empty:** outbound Wikipedia blocked on droplet — fallback JSON in `seed_fallback.json` ships in the image (not under `data/`, excluded by `.dockerignore`).

## StoryMagic — revenue while Stripe unset (2026-05-20–21)

| Item | Status |
|------|--------|
| Print-interest waitlist UI | **Shipped** — `POST /api/print-interest`, preview “Notify me” |
| Admin visibility | **Shipped** — Orders page + `query_storybook_print_leads.sh` (`6f8d7aeb` fixes imports) |
| Stripe checkout | **Blocked** — set `STORYBOOK_STRIPE_*` in admin Env → `./scripts/check-revenue-env-http.sh` |

## 1PageResearch — cold / OOM (2026-05-21)

| Item | Status |
|------|--------|
| Container `Exited (137)` | **Mitigated** — `activator_never_evict`, `mem_limit` 192m; `docker compose up -d 1pageresearch` |
| Revenue probe 302 to activator | **Fixed probe** — `check-revenue-env-http.sh` follows redirects and detects non-JSON |
| Stripe €1 checkout | **Blocked** — `ONEPAGE_STRIPE_SECRET_KEY` in admin Env; free requests + BYO key on `/generate` |

## Droplet deploy drift

If `git rev-parse HEAD` on the server lags `main`, run:

```bash
cd /opt/216labs && git pull && docker compose up -d --force-recreate maxlearn storybook admin
```

Or subset: `DEPLOY_RUNTIME_APPS="maxlearn storybook admin" DEPLOY_IMAGE_SOURCE=local ./deploy.sh root@46.101.88.197`
