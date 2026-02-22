import { Queue, type ConnectionOptions } from "bullmq";

let connection: ConnectionOptions | null = null;

export function getRedisConnection(): ConnectionOptions {
  if (!connection) {
    const url = new URL(process.env.REDIS_URL || "redis://localhost:6379");
    connection = {
      host: url.hostname,
      port: parseInt(url.port || "6379"),
      maxRetriesPerRequest: null,
    };
  }
  return connection;
}

export interface InitialScanJob {
  projectId: string;
  userId: string;
  repoFullName: string;
  branch: string;
  scanId: string;
}

export interface CommitScanJob {
  projectId: string;
  userId: string;
  repoFullName: string;
  commitSha: string;
  branch: string;
  scanId: string;
  installationId: number;
}

let scanQueue: Queue | null = null;

export function getScanQueue(): Queue {
  if (!scanQueue) {
    scanQueue = new Queue("scans", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return scanQueue;
}
