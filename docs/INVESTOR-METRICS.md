# Investor-facing metrics (org health)

This repo is a “vibe-code factory” with a **shell** (admin DB + deploy + routing + ops) and a portfolio of apps.
Investors care whether the factory is **converging on excellence** (velocity with improving reliability) or accumulating complexity debt.

## One command snapshot

From repo root:

```bash
python3 scripts/org_metrics.py
```

Write both JSON + markdown artifacts:

```bash
python3 scripts/org_metrics.py --write quality-reports/org-metrics
```

## What the snapshot includes

- **Velocity (git)**
  - Total commits
  - Commits in the last 7 / 30 days (simple momentum signal)
- **Surface area (apps)**
  - Count of `manifest.json` under `products/` and `internal/` (proxy for shipped surfaces)
- **Production signals (from `216labs.db`)**
  - **Error volume**: count of rows in `client_error_event` for last 24h and 7d
  - **Edge uniques**: rolling distinct visitors from `edge_visitor_day` (1d/7d/30d) plus top apps
  - **Enabled apps**: `apps.deploy_enabled` count (when present)

## Reading the results

Good signs:

- **Commits stay healthy** while **errors_24h** trends flat or down
- **Edge uniques** grow faster than errors (quality doesn’t collapse under growth)
- Enabled app count grows, while error concentration is limited to a few known targets (not a broad regression)

Bad signs:

- **Error volume climbs** with no corresponding unique growth
- Errors spread across many apps (systemic regressions / shared infra issues)
- Enabled surfaces expand faster than the ability to keep them healthy

## Notes / caveats

- `edge_visitor_day` is a coarse edge approximation (hash of IP + UA per UTC day), not GA identity.
- `client_error_event` is “reported errors” (client/server) — it is a quality proxy, not complete observability.
- If `216labs.db` is not present locally, the script will still emit git + manifest metrics and mark DB metrics unavailable.

