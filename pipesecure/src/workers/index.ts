import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection } from "../lib/queue";
import type { InitialScanJob, CommitScanJob } from "../lib/queue";
import { handleInitialScan, handleCommitScan } from "./scan-worker";

const connection = getRedisConnection();

console.log("[worker] Starting PipeSecure scan worker...");

const worker = new Worker(
  "scans",
  async (job) => {
    console.log(`[worker] Processing job ${job.id} (${job.name})`);

    try {
      if (job.name === "initial-scan") {
        await handleInitialScan(job.data as InitialScanJob);
      } else if (job.name === "commit-scan") {
        await handleCommitScan(job.data as CommitScanJob);
      } else {
        console.warn(`[worker] Unknown job type: ${job.name}`);
      }
    } catch (error) {
      console.error(`[worker] Job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[worker] Worker error:", err);
});

process.on("SIGTERM", async () => {
  console.log("[worker] Shutting down...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[worker] Shutting down...");
  await worker.close();
  process.exit(0);
});
