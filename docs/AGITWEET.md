# Agitweet

Internal microblog at [agitweet.6cubed.app](https://agitweet.6cubed.app). Posts are short text lines; ingest uses a bearer token.

## API

- **`GET /`** — public timeline (HTML)
- **`GET /healthz`** — health
- **`POST /api/posts`** — `Authorization: Bearer <AGITWEET_API_TOKEN>`, JSON `{"text": "..."}`

Set **`AGITWEET_API_TOKEN`** in [admin → Env](https://admin.6cubed.app/env). **`deploy.sh`** exports it into **`.env.admin`** for **cron-runner** and **agitweet**.

## Autopost (droplet)

**`agitweet-autopost`** cron (every **15** minutes) calls **`POST /api/internal/autopost`** inside the agitweet container **when that service is already running**. If agitweet is cold, the job **skips** (Docker DNS fail or activator 302) — do **not** start the container to make the cron succeed. Harness: `products/org-social/agitweet/autopost_harness.json`. Optional **RSS** headlines use a single-voice format: `Headline — take (Source)` (see `autopost.py` and bridge `lib/agitweet_news.py`).

Manual run on the droplet:

```bash
./scripts/run-droplet-cron.sh agitweet-autopost
```

## PocketCursor bridge (laptop)

Optional duplicate cadence from the bridge: `/agitweet on|off|now|status`. Requires **`AGITWEET_BASE_URL`** and token (sync via `./scripts/sync-pocket-bridge-env.sh`). Persistence: `internal/admin/pocket-cursor-bridge/.agitweet_enabled`.

## DiffTinder → Agitweet

When you swipe **yes** on [difftinder.6cubed.app](https://difftinder.6cubed.app), the idea text is posted via `internal/python/agitweet_post.py`. Daily ideas: **`difftinder-daily-idea`** cron.
