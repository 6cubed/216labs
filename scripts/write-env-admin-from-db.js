#!/usr/bin/env node
/**
 * Emit KEY=value lines for docker compose --env-file .env.admin
 * Values must escape literal $ as $$ or Compose treats $2a / $10 / $GHCR as substitutions.
 *
 * Usage: node scripts/write-env-admin-from-db.js [path/to/216labs.db]
 * Default DB path: /app/216labs.db (admin container).
 */
// Resolve from admin image /app/node_modules when run with: docker exec -w /app … node …/write-env-admin-from-db.js
const Database = require("better-sqlite3");
const path = process.argv[2] || "/app/216labs.db";
const db = new Database(path);
const rows = db
  .prepare(
    "SELECT key, value FROM env_vars WHERE value IS NOT NULL AND length(trim(value)) > 0"
  )
  .all();

/** Docker Compose .env: literal $ must be written as $$ */
function escapeComposeEnvValue(v) {
  return String(v).replace(/\$/g, "$$$$");
}

for (const r of rows) {
  process.stdout.write(r.key + "=" + escapeComposeEnvValue(r.value) + "\n");
}
db.close();
