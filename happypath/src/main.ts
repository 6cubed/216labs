import { runAllTests } from "./runner.js";
import { getEnabledAppIds, testRunStore, getStatusData } from "./db.js";
import { startStatusServer } from "./status.js";
import { config } from "./config.js";

const runOnce = process.argv.includes("--once");

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTestCycle(): Promise<void> {
  const appIds = getEnabledAppIds();
  if (appIds.length === 0) {
    console.log("[happypath] No enabled apps to test");
    return;
  }

  console.log(`[happypath] Testing ${appIds.length} apps...`);
  const runId = testRunStore.start();

  try {
    const results = await runAllTests(appIds);
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    for (const r of results) {
      testRunStore.insertResult({
        runId,
        appId: r.appId,
        baseUrl: r.baseUrl,
        passed: r.passed,
        message: r.message,
        durationMs: r.durationMs,
      });
    }

    testRunStore.finish(runId, results.length, passed, failed);
    console.log(`[happypath] Done — ${passed}/${results.length} passed, ${failed} failed`);
  } catch (err) {
    console.error("[happypath] Run error:", err);
    testRunStore.finish(runId, appIds.length, 0, appIds.length);
  }
}

async function main(): Promise<void> {
  console.log("[happypath] Starting up");
  console.log(
    `[happypath] Testing apps every ${config.testIntervalHours}h (APP_HOST=${config.appHost})`
  );

  startStatusServer(config.port);

  if (runOnce) {
    await runTestCycle();
    process.exit(0);
    return;
  }

  while (true) {
    try {
      await runTestCycle();
    } catch (err) {
      console.error("[happypath] Cycle error:", err);
    }
    console.log(`[happypath] Next run in ${config.testIntervalHours}h`);
    await sleep(config.testIntervalMs);
  }
}

main().catch((err) => {
  console.error("[happypath] Fatal error:", err);
  process.exit(1);
});
