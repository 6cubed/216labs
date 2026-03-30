#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import polars as pl
import requests


API_URL = "https://hn.algolia.com/api/v1/search_by_date"


def fetch_rows(target_rows: int) -> list[dict]:
    rows: list[dict] = []
    page = 0

    while len(rows) < target_rows:
        params = {
            "query": "ai",
            "tags": "story",
            "hitsPerPage": 1000,
            "page": page,
        }
        res = requests.get(API_URL, params=params, timeout=30)
        res.raise_for_status()
        payload = res.json()
        hits = payload.get("hits", [])
        if not hits:
            break

        rows.extend(hits)
        if page >= payload.get("nbPages", 0) - 1:
            break
        page += 1

    return rows[:target_rows]


def transform(rows: list[dict]) -> pl.DataFrame:
    df = pl.from_dicts(rows)

    selected = df.select(
        [
            pl.col("objectID").alias("row_id"),
            pl.col("title").fill_null(""),
            pl.col("url").fill_null(""),
            pl.col("author").fill_null("unknown"),
            pl.col("created_at").fill_null(""),
            pl.col("points").fill_null(0).cast(pl.Int64),
            pl.col("num_comments").fill_null(0).cast(pl.Int64),
        ]
    )

    # Feature columns useful for quick data science exploration.
    enriched = selected.with_columns(
        [
            pl.col("title").str.len_chars().alias("title_length"),
            (pl.col("points") + pl.col("num_comments")).alias("engagement_score"),
            pl.when(pl.col("url") == "")
            .then(pl.lit("no_url"))
            .otherwise(pl.lit("has_url"))
            .alias("url_status"),
        ]
    )
    return enriched


def write_outputs(df: pl.DataFrame, raw_rows: list[dict], output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)

    raw_path = output_dir / "raw.ndjson"
    with raw_path.open("w", encoding="utf-8") as f:
        for row in raw_rows:
            f.write(json.dumps(row, ensure_ascii=True) + "\n")

    parquet_path = output_dir / "dataset.parquet"
    df.write_parquet(parquet_path)

    duckdb_path = output_dir / "dataset.duckdb"
    conn = duckdb.connect(str(duckdb_path))
    conn.execute("CREATE OR REPLACE TABLE records AS SELECT * FROM read_parquet(?)", [str(parquet_path)])
    conn.close()

    created_at = datetime.now(timezone.utc).isoformat()
    summary = {
        "job_id": "web-scrape-demo",
        "created_at": created_at,
        "row_count": df.height,
        "columns": df.columns,
        "artifacts": {
            "raw": str(raw_path.name),
            "parquet": str(parquet_path.name),
            "duckdb": str(duckdb_path.name),
        },
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Run 216Labs data jobs MVP scrape+transform demo.")
    parser.add_argument("--target-rows", type=int, default=10_000)
    parser.add_argument("--output-dir", type=str, default="internal/data-jobs/out/web-scrape-demo")
    args = parser.parse_args()

    output_dir = Path(args.output_dir).resolve()
    rows = fetch_rows(args.target_rows)
    df = transform(rows)
    summary = write_outputs(df, rows, output_dir)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
