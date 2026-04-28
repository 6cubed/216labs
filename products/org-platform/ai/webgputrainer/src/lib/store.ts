import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export type WorkerInfo = {
  id: string;
  name?: string;
  secret: string;
  createdAt: number;
  lastSeenAt: number;
  webgpu: boolean;
  userAgent?: string;
};

export type RunInfo = {
  id: string;
  name: string;
  createdAt: number;
  status: "queued" | "running" | "done" | "failed";
  config: Record<string, unknown>;
};

export type TaskInfo = {
  id: string;
  runId: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: number;
  claimedAt?: number;
  claimedBy?: string;
  finishedAt?: number;
  status: "queued" | "claimed" | "done" | "failed";
  result?: Record<string, unknown>;
  error?: string;
};

type StoreShape = {
  workers: Record<string, WorkerInfo>;
  runs: Record<string, RunInfo>;
  tasks: Record<string, TaskInfo>;
};

const DATA_DIR = process.env.WEBGPUTRAINER_DATA_DIR || "/app/data";
const STORE_PATH = path.join(DATA_DIR, "webgputrainer.json");

let inMemory: StoreShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

function now() {
  return Date.now();
}

function randId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

async function ensureLoaded(): Promise<StoreShape> {
  if (inMemory) return inMemory;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    inMemory = JSON.parse(raw) as StoreShape;
  } catch {
    inMemory = { workers: {}, runs: {}, tasks: {} };
  }
  return inMemory;
}

async function persist(store: StoreShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const payload = JSON.stringify(store, null, 2);
  await fs.writeFile(STORE_PATH, payload, "utf8");
}

async function mutate<T>(fn: (store: StoreShape) => T | Promise<T>): Promise<T> {
  const store = await ensureLoaded();
  const out = await fn(store);
  writeChain = writeChain.then(() => persist(store)).catch(() => persist(store));
  await writeChain;
  return out;
}

export function isAdminAuthorized(req: Request): boolean {
  const required = process.env.WEBGPUTRAINER_ADMIN_KEY?.trim();
  if (!required) return true;
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  return token === required;
}

export async function getStatus() {
  const store = await ensureLoaded();
  const workers = Object.values(store.workers);
  const runs = Object.values(store.runs);
  const tasks = Object.values(store.tasks);
  return {
    ok: true,
    workers: {
      total: workers.length,
      webgpu: workers.filter((w) => w.webgpu).length,
      active_5m: workers.filter((w) => now() - w.lastSeenAt < 5 * 60_000).length,
    },
    runs: {
      total: runs.length,
      queued: runs.filter((r) => r.status === "queued").length,
      running: runs.filter((r) => r.status === "running").length,
      done: runs.filter((r) => r.status === "done").length,
      failed: runs.filter((r) => r.status === "failed").length,
    },
    tasks: {
      total: tasks.length,
      queued: tasks.filter((t) => t.status === "queued").length,
      claimed: tasks.filter((t) => t.status === "claimed").length,
      done: tasks.filter((t) => t.status === "done").length,
      failed: tasks.filter((t) => t.status === "failed").length,
    },
  };
}

export async function registerWorker(input: {
  name?: string;
  webgpu: boolean;
  userAgent?: string;
}): Promise<{ workerId: string; workerSecret: string }> {
  return mutate((store) => {
    const id = randId("w");
    const secret = crypto.randomBytes(18).toString("base64url");
    store.workers[id] = {
      id,
      name: input.name,
      secret,
      createdAt: now(),
      lastSeenAt: now(),
      webgpu: input.webgpu,
      userAgent: input.userAgent,
    };
    return { workerId: id, workerSecret: secret };
  });
}

export async function authenticateWorker(req: Request): Promise<WorkerInfo | null> {
  const wid = req.headers.get("x-worker-id")?.trim() || "";
  const sec = req.headers.get("x-worker-secret")?.trim() || "";
  if (!wid || !sec) return null;
  const store = await ensureLoaded();
  const w = store.workers[wid];
  if (!w || w.secret !== sec) return null;
  return w;
}

export async function heartbeat(workerId: string): Promise<void> {
  await mutate((store) => {
    const w = store.workers[workerId];
    if (w) w.lastSeenAt = now();
  });
}

export async function createRun(input: {
  name: string;
  config?: Record<string, unknown>;
}): Promise<RunInfo> {
  return mutate((store) => {
    const id = randId("run");
    const run: RunInfo = {
      id,
      name: input.name,
      createdAt: now(),
      status: "queued",
      config: input.config ?? {},
    };
    store.runs[id] = run;
    return run;
  });
}

export async function listRuns(): Promise<RunInfo[]> {
  const store = await ensureLoaded();
  return Object.values(store.runs).sort((a, b) => b.createdAt - a.createdAt);
}

export async function enqueueTasks(input: {
  runId: string;
  kind: string;
  tasks: Array<{ payload: Record<string, unknown> }>;
}): Promise<{ enqueued: number }> {
  return mutate((store) => {
    const run = store.runs[input.runId];
    if (!run) throw new Error("run_not_found");
    if (run.status === "queued") run.status = "running";
    for (const t of input.tasks) {
      const id = randId("t");
      store.tasks[id] = {
        id,
        runId: input.runId,
        kind: input.kind,
        payload: t.payload,
        createdAt: now(),
        status: "queued",
      };
    }
    return { enqueued: input.tasks.length };
  });
}

export async function claimNextTask(workerId: string): Promise<TaskInfo | null> {
  return mutate((store) => {
    const tasks = Object.values(store.tasks)
      .filter((t) => t.status === "queued")
      .sort((a, b) => a.createdAt - b.createdAt);
    const next = tasks[0];
    if (!next) return null;
    next.status = "claimed";
    next.claimedAt = now();
    next.claimedBy = workerId;
    return next;
  });
}

export async function reportTask(input: {
  taskId: string;
  workerId: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}): Promise<TaskInfo> {
  return mutate((store) => {
    const t = store.tasks[input.taskId];
    if (!t) throw new Error("task_not_found");
    if (t.claimedBy && t.claimedBy !== input.workerId) throw new Error("task_claimed_by_other");
    t.finishedAt = now();
    t.status = input.ok ? "done" : "failed";
    t.result = input.result;
    t.error = input.ok ? undefined : input.error || "failed";
    return t;
  });
}

