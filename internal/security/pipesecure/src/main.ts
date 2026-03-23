import { runScan } from "./scan";
import { startStatusServer } from "./status";

const INTERVAL_MS =
  parseFloat(process.env.SCAN_INTERVAL_HOURS || "24") * 60 * 60 * 1000;
const PORT = parseInt(process.env.PORT || "3000", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  console.log("[pipesecure] Starting up");
  console.log(
    `[pipesecure] Scanning ${process.env.GITHUB_REPO || "6cubed/216labs"} every ${process.env.SCAN_INTERVAL_HOURS || "24"}h`
  );

  startStatusServer(PORT);

  while (true) {
    try {
      await runScan();
    } catch (err) {
      console.error("[pipesecure] Scan error:", err);
    }
    console.log(
      `[pipesecure] Next scan in ${process.env.SCAN_INTERVAL_HOURS || "24"}h`
    );
    await sleep(INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error("[pipesecure] Fatal error:", err);
  process.exit(1);
});
