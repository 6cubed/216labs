import Dockerode from "dockerode";

// Docker Compose names containers as: <project>-<service>-<replica>
const COMPOSE_PROJECT = process.env.COMPOSE_PROJECT_NAME || "216labs";
const SOCKET_PATH = "/var/run/docker.sock";

function containerName(dockerService: string): string {
  return `${COMPOSE_PROJECT}-${dockerService}-1`;
}

function getClient(): Dockerode | null {
  try {
    const { existsSync } = require("fs") as typeof import("fs");
    if (!existsSync(SOCKET_PATH)) return null;
    return new Dockerode({ socketPath: SOCKET_PATH });
  } catch {
    return null;
  }
}

export async function startContainer(dockerService: string): Promise<void> {
  const docker = getClient();
  if (!docker) return;
  const container = docker.getContainer(containerName(dockerService));
  const info = await container.inspect();
  if (!info.State.Running) {
    await container.start();
  }
}

export async function stopContainer(dockerService: string): Promise<void> {
  const docker = getClient();
  if (!docker) return;
  const container = docker.getContainer(containerName(dockerService));
  const info = await container.inspect();
  if (info.State.Running) {
    await container.stop({ t: 5 });
  }
}

export type ContainerStatus = "running" | "stopped" | "missing" | "unknown";

export async function getContainerStatus(
  dockerService: string
): Promise<ContainerStatus> {
  const docker = getClient();
  if (!docker) return "unknown";
  try {
    const info = await docker
      .getContainer(containerName(dockerService))
      .inspect();
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
 * Returns the set of docker_service names that are currently running,
 * identified by matching the compose project label.
 */
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
