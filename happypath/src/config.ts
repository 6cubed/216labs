const APP_HOST = process.env.APP_HOST || process.env.HAPPYPATH_APP_HOST || "agimemes.com";
const TEST_INTERVAL_HOURS = parseFloat(
  process.env.TEST_INTERVAL_HOURS || process.env.HAPPYPATH_TEST_INTERVAL_HOURS || "6"
);
const PORT = parseInt(process.env.PORT || "3000", 10);

/** Path to 216labs admin SQLite DB (read-only) to discover enabled apps. */
export const LABS_DB_PATH =
  process.env.DATABASE_PATH ||
  process.env.HAPPYPATH_DATABASE_PATH ||
  "/app/216labs.db";

export const config = {
  appHost: APP_HOST,
  testIntervalHours: TEST_INTERVAL_HOURS,
  testIntervalMs: TEST_INTERVAL_HOURS * 60 * 60 * 1000,
  port: PORT,
  dataDir: process.env.DATA_DIR || "/app/data",
};
