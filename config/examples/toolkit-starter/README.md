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

Review the contents, adjust app IDs, then redeploy or restart admin so the DB picks up bootstrap rules.

## What changes

- **`deploy-bootstrap.txt`** — app IDs that should be **deploy_enabled** when synced from the admin (subset of your monorepo).
- **`deploy-priority.txt`** — order used when capping how many images deploy in one run (`DEPLOY_MAX_APPS`).

The **production** 216Labs repo keeps a larger set in `config/`; this folder is the **minimal template** only.
