# Data Jobs MVP

This folder is a minimal, cost-conscious data engineering pipeline setup:

- run scraping and transforms in CI (or locally),
- publish compact artifacts (`parquet`, `duckdb`, summary JSON),
- avoid storing data on the droplet.

## Included sample job

`web-scrape-demo` demonstrates a concrete workflow:

1. Scrape approximately 10,000 rows from a public API.
2. Normalize and transform into analytics-friendly columns.
3. Export:
   - `raw.ndjson`
   - `dataset.parquet`
   - `dataset.duckdb`
   - `summary.json`

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r internal/data-jobs/requirements.txt
python internal/data-jobs/web-scrape-demo/run_job.py --output-dir /tmp/216labs-data-demo
```

## CI

GitHub Actions workflow: `.github/workflows/data-jobs-mvp.yml`

- manual dispatch,
- daily schedule,
- artifact upload for downstream analysis and notebook exploration.
