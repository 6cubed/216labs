import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";

const COMPOSE_PROJECT = process.env.COMPOSE_PROJECT_NAME || "216labs";

function projectRoot(): string {
  return (
    process.env.SYNC_PROJECT_ROOT ||
    process.env.ADMIN_PROJECT_ROOT ||
    process.env.PROJECTS_ROOT ||
    "/workspace"
  ).replace(/\/$/, "");
}

function envAdminPath(): string {
  return join(projectRoot(), ".env.admin");
}

function dbPath(): string {
  return process.env.DATABASE_PATH || join(projectRoot(), "216labs.db");
}

/** Env keys that should hot-reload a compose service after save (revenue path). */
const PREFIX_TO_DOCKER_SERVICE: Array<[string, string]> = [
  ["NEXT_PUBLIC_STORYBOOK_", "storybook"],
  ["STORYBOOK_", "storybook"],
  ["ONEPAGE_", "1pageresearch"],
  ["NEXT_PUBLIC_MERCH_", "merch"],
];

export function dockerServiceForEnvKey(key: string): string | null {
  for (const [prefix, svc] of PREFIX_TO_DOCKER_SERVICE) {
    if (key.startsWith(prefix)) return svc;
  }
  return null;
}

function runCommand(
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    const t = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) resolve();
      else
        reject(
          new Error(stderr.trim().slice(-800) || `exit ${code ?? "unknown"}`)
        );
    });
  });
}

/** Regenerate /opt/216labs/.env.admin from 216labs.db (same as deploy.sh). */
export async function syncEnvAdminFromDb(): Promise<void> {
  const root = projectRoot();
  const script = join(root, "scripts/export-env-admin-from-db.py");
  if (!existsSync(script)) {
    throw new Error(`export-env-admin-from-db.py not found at ${script}`);
  }
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn("python3", [script, dbPath()], { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `export exit ${code}`));
    });
  });
  const target = envAdminPath();
  writeFileSync(target, out, "utf-8");
}

/** Apply new env to one running service without a laptop deploy. */
export async function recreateComposeService(dockerService: string): Promise<void> {
  const root = projectRoot();
  const args = [
    "docker",
    "compose",
    "--env-file",
    ".env",
    "--env-file",
    ".env.admin",
    "up",
    "-d",
    "--force-recreate",
    "--no-build",
    dockerService,
  ];
  await runCommand(args, root, 180_000);
}

export function canHotReloadEnvOnHost(): boolean {
  return existsSync("/var/run/docker.sock") && existsSync(projectRoot());
}
