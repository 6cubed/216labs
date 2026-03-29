import Dockerode from "dockerode";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { isGhcrSyncExcludedService } from "@/lib/ghcr-pull";

// Compose v2 default name is {project}_{service}_{replica} (underscores). Labels are authoritative.
const COMPOSE_PROJECT = process.env.COMPOSE_PROJECT_NAME || "216labs";
const SOCKET_PATH = "/var/run/docker.sock";

/** Compose project root on the VPS (admin container: /workspace). */
function syncProjectRoot(): string {
  return (
    process.env.SYNC_PROJECT_ROOT ||
    process.env.ADMIN_PROJECT_ROOT ||
    "/workspace"
  ).replace(/\/$/, "");
}

/** Resolve the container for a compose service (labels first, then common name patterns). */
async function getComposeContainer(
  docker: Dockerode,
  dockerService: string
): Promise<Dockerode.Container | null> {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: JSON.stringify({
        label: [
          `com.docker.compose.project=${COMPOSE_PROJECT}`,
          `com.docker.compose.service=${dockerService}`,
        ],
      }),
    });
    if (containers.length > 0) {
      return docker.getContainer(containers[0].Id);
    }
  } catch {
    /* fall through */
  }
  for (const name of [
    `${COMPOSE_PROJECT}_${dockerService}_1`,
    `${COMPOSE_PROJECT}-${dockerService}-1`,
  ]) {
    const c = docker.getContainer(name);
    try {
      await c.inspect();
      return c;
    } catch {
      continue;
    }
  }
  return null;
}

function getClient(): Dockerode | null {
  try {
    if (!existsSync(SOCKET_PATH)) return null;
    return new Dockerode({ socketPath: SOCKET_PATH });
  } catch {
    return null;
  }
}

/**
 * Start a compose service. If the container has never been created (cold server
 * or app never included in a deploy), `docker start` cannot work — we POST to
 * the Activator so `docker compose up` runs (same path as subdomain warmup).
 */
export async function startContainer(
  dockerService: string,
  appId: string = dockerService
): Promise<void> {
  const docker = getClient();
  if (!docker) return;
  const container = await getComposeContainer(docker, dockerService);
  if (container) {
    const info = await container.inspect();
    if (!info.State.Running) {
      await container.start();
    }
    return;
  }

  const base = (
    process.env.ACTIVATOR_INTERNAL_URL || "http://activator:3040"
  ).replace(/\/$/, "");
  const url = `${base}/api/start/${encodeURIComponent(appId)}`;
  // Activator waits up to ACTIVATOR_START_TIMEOUT_SECONDS for HTTP after compose up, then may restart once.
  // Keep this above gunicorn timeout / worst-case cold start (see activator Dockerfile).
  const ms = Number.parseInt(
    process.env.ACTIVATOR_ADMIN_FETCH_TIMEOUT_MS || "240000",
    10
  );
  const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 240_000;
  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.text();
  if (res.status === 200 || res.status === 202) return;
  // Image missing but deploy webhook accepted — container will appear after deploy; keep toggle on.
  if (res.status === 503) {
    try {
      const data = JSON.parse(body) as { phase?: string };
      if (data.phase === "deploying") return;
    } catch {
      /* fall through */
    }
  }
  throw new Error(
    `Activator start failed (${res.status}): ${body.slice(0, 800)}`
  );
}

export async function stopContainer(dockerService: string): Promise<void> {
  const docker = getClient();
  if (!docker) return;
  const container = await getComposeContainer(docker, dockerService);
  if (!container) return;
  try {
    const info = await container.inspect();
    if (info.State.Running) {
      await container.stop({ t: 5 });
    }
  } catch (err: unknown) {
    const code = (err as { statusCode?: number }).statusCode;
    if (code === 404) return;
    throw err;
  }
}

export type ContainerStatus = "running" | "stopped" | "missing" | "unknown";

export async function getContainerStatus(
  dockerService: string
): Promise<ContainerStatus> {
  const docker = getClient();
  if (!docker) return "unknown";
  try {
    const container = await getComposeContainer(docker, dockerService);
    if (!container) return "missing";
    const info = await container.inspect();
    return info.State.Running ? "running" : "stopped";
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode === 404
    ) {
      return "missing";
    }
    return "unknown";
  }
}

/**
 * Returns the last `tail` log lines from a container's stdout+stderr.
 * Docker wraps logs in a multiplexed stream — each frame has an 8-byte header:
 *   byte 0 = stream type (1=stdout, 2=stderr), bytes 4-7 = uint32 BE frame size.
 */
export async function getContainerLogs(
  dockerService: string,
  tail = 60
): Promise<string[]> {
  const docker = getClient();
  if (!docker) return [];
  try {
    const container = await getComposeContainer(docker, dockerService);
    if (!container) return [];
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      container.logs(
        { stdout: true, stderr: true, tail, follow: false },
        (err: Error | null, data?: Buffer | NodeJS.ReadableStream) => {
          if (err) return reject(err);
          if (Buffer.isBuffer(data)) return resolve(data);
          const chunks: Buffer[] = [];
          const stream = data as NodeJS.ReadableStream;
          stream.on("data", (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          stream.on("end", () => resolve(Buffer.concat(chunks)));
          stream.on("error", reject);
        }
      );
    });

    const lines: string[] = [];
    let offset = 0;
    while (offset + 8 <= buffer.length) {
      const frameSize = buffer.readUInt32BE(offset + 4);
      if (frameSize > 0) {
        const chunk = buffer
          .slice(offset + 8, offset + 8 + frameSize)
          .toString("utf8");
        for (const line of chunk.split("\n")) {
          const trimmed = line.trimEnd();
          if (trimmed) lines.push(trimmed);
        }
      }
      offset += 8 + frameSize;
    }
    return lines;
  } catch {
    return [];
  }
}

/**
 * Returns the set of docker_service names that are currently running,
 * identified by matching the compose project label.
 */
/**
 * Pull GHCR :latest for one compose service, retag to 216labs/*:latest, recreate container.
 * Same logic as scripts/droplet-ghcr-sync.sh (requires docker socket + compose project on disk).
 */
export async function pullLatestGhcrForService(
  dockerService: string
): Promise<void> {
  const svc = dockerService.trim().toLowerCase();
  if (!svc) {
    throw new Error("Missing docker service name");
  }
  if (isGhcrSyncExcludedService(svc)) {
    throw new Error(
      `${dockerService} is infrastructure — use a full deploy to change it`
    );
  }
  if (!existsSync(SOCKET_PATH)) {
    throw new Error(
      "Docker socket not available (run admin on the host stack with /var/run/docker.sock mounted)"
    );
  }
  const root = syncProjectRoot();
  const script = join(root, "scripts/droplet-ghcr-sync.sh");
  if (!existsSync(script)) {
    throw new Error(`GHCR sync script not found at ${script}`);
  }
  await new Promise<void>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn("/bin/bash", [script], {
      cwd: root,
      env: {
        ...process.env,
        SYNC_PROJECT_ROOT: root,
        SYNC_SERVICE: dockerService,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const t = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("GHCR pull timed out after 7m"));
    }, 420_000);
    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(t);
      const tail = (stderr || stdout).trim().slice(-1500);
      if (code === 0) {
        if (tail && process.env.NODE_ENV !== "production") {
          console.log("[pullLatestGhcrForService]", tail);
        }
        resolve();
      } else {
        reject(
          new Error(
            tail || `droplet-ghcr-sync exited with code ${code ?? "unknown"}`
          )
        );
      }
    });
  });
}

export async function getRunningServices(): Promise<Set<string>> {
  const docker = getClient();
  if (!docker) return new Set();
  try {
    const containers = await docker.listContainers({
      filters: JSON.stringify({
        label: [`com.docker.compose.project=${COMPOSE_PROJECT}`],
      }),
    });
    const running = new Set<string>();
    for (const c of containers) {
      const svc = c.Labels?.["com.docker.compose.service"];
      if (svc) running.add(svc);
    }
    return running;
  } catch {
    return new Set();
  }
}
