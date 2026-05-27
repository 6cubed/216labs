# Admin panel access

The factory dashboard at [admin.6cubed.app](https://admin.6cubed.app) is protected by **Caddy basic auth** in front of the Next.js app. Credentials live in **`216labs.db`** (`env_vars` keys **`ADMIN_USER`**, **`ADMIN_PASSWORD_HASH`**) and are exported to **`.env.admin`** on deploy.

## Forgot password

**Telegram (PocketCursor bridge):** `/adminpass reset` — owner/allowlist only. Runs `scripts/reset-admin-basic-auth.sh` on the droplet (or locally when `216LABS_DB` points at your DB), rotates user/password, recreates **caddy** + **admin**, and **pastes the new password into chat**. Do not log passwords in git or docs.

**SSH on the droplet:**

```bash
cd /opt/216labs && ./scripts/reset-admin-basic-auth.sh
```

The script prints `User:` and `Pass:` lines; it also updates the DB and `.env.admin`.

## Internal apps that share admin login

**DiffTinder**, **groundtruth**, and **workforce** use cookie login via `internal/python/admin_session.py` with **`ADMIN_PANEL_PASSWORD`** from admin **Env** (same value you use for the admin UI password when using the default reset flow). Set or rotate it in [admin → Env](https://admin.6cubed.app/env) or let `/adminpass reset` populate **`ADMIN_PANEL_PASSWORD`** when the bootstrap script runs.

## Env export on deploy

`deploy.sh` prefers **`python3 scripts/export-env-admin-from-db.py`** so **`.env.admin`** is not empty when the admin container is down. **`scripts/bootstrap-internal-panel-env.py`** seeds empty **`CRON_RUNNER_SECRET`**, **`AGITWEET_API_TOKEN`**, and **`ADMIN_PANEL_PASSWORD`** on first deploy.
