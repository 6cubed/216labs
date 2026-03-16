---
name: always-deploy-after-change
description: Commit, push, and deploy repo changes to the 216labs DigitalOcean droplet after code updates. Use when the user asks to deploy, mentions "always deploy", or after modifying apps or infrastructure.
---

# Always Deploy After Change

## When to use

Use this skill when:
- The user asks to deploy or says "always deploy"
- Any app or infrastructure file in this repo was changed
- A task is otherwise done but not yet shipped

## Required workflow

1. Stage only relevant files for the task.
2. Commit with a clear message.
3. Push to `origin main`.
4. Run deployment from repo root:

```bash
./deploy.sh root@46.101.88.197
```

Use a long timeout (for example 300000 ms) because build + transfer can take minutes.

## Verification checklist

- Confirm deploy command exits successfully.
- SSH check that containers are running:

```bash
ssh root@46.101.88.197 "cd /opt/216labs && docker compose ps"
```

- If admin env keys were changed for an app, verify in SQLite:

```bash
ssh root@46.101.88.197 "sqlite3 /opt/216labs/216labs.db \"SELECT key FROM env_vars WHERE key LIKE 'APPNAME_%';\""
```

## Failure handling

- If Docker is not running locally:
  - Still commit and push.
  - Tell the user deployment is pending until Docker Desktop is started.
- Do not build images on the server.
- Do not skip deployment unless explicitly blocked by local Docker availability.
