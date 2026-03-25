# Toolkit starter — example deploy config

Use these files when you want a **small, client-agnostic** surface (fewer apps enabled by default) before publishing a community starter repo or trimming the portfolio.

## Apply

From the repo root:

```bash
./scripts/init-toolkit-starter-config.sh
```

Or copy by hand:

```bash
cp config/examples/toolkit-starter/deploy-bootstrap.txt config/deploy-bootstrap.txt
cp config/examples/toolkit-starter/deploy-priority.txt config/deploy-priority.txt
```

Review the contents, adjust app IDs, then redeploy or restart admin so the DB picks up bootstrap rules (optional — you can leave bootstrap empty and use the admin UI only).

## What changes

- **`deploy-bootstrap.txt`** — optional few IDs for `deploy_enabled` on admin sync; production normally uses dashboard toggles + CI.
- **`deploy-priority.txt`** — order used when capping how many images deploy in one run (`DEPLOY_MAX_APPS`).

The **production** repo keeps `deploy-bootstrap.txt` mostly empty; this folder is a **minimal template** for forks.
