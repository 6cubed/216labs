"use server";

import { setDeployEnabled, setEnvVarValue, getDb } from "@/lib/db";
import { startContainer, stopContainer } from "@/lib/docker";
import { revalidatePath } from "next/cache";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";

// Ordered longest-first so more-specific prefixes (NEXT_PUBLIC_STORYBOOK_) match before shorter ones.
const PREFIX_TO_DIR: Array<[string, string]> = [
  ["NEXT_PUBLIC_STORYBOOK_", "storybook"],
  ["STORYBOOK_", "storybook"],
  ["AUDIOAICHECKUP_", "audioaicheckup"],
  ["NEXT_PUBLIC_ONEFIT_", "onefit"],
  ["ONEFIT_", "onefit"],
  ["NEXT_PUBLIC_ONEROOM_", "oneroom"],
  ["ONEROOM_", "oneroom"],
  ["AGIMEMES_", "agimemes"],
  ["PIPESECURE_", "pipesecure"],
  ["PRIORS_", "priors"],
  ["AGITSHIRTS_", "agitshirts"],
  ["RAMBLINGRADIO_", "RamblingRadio"],
  ["PAPERFRAME_", "paperframe"],
  ["HIVEFIND_", "hivefind"],
];

function getAppDirForKey(key: string): string | null {
  for (const [prefix, dir] of PREFIX_TO_DIR) {
    if (key.startsWith(prefix)) return dir;
  }
  return null;
}

function writeEnvLocal(appDir: string): void {
  const projectsRoot =
    process.env.PROJECTS_ROOT || join(process.cwd(), "..");
  const appPath = join(projectsRoot, appDir);
  if (!existsSync(appPath)) return;

  const appPrefixes = PREFIX_TO_DIR
    .filter(([, dir]) => dir === appDir)
    .map(([prefix]) => prefix);

  const allVars = getDb()
    .prepare("SELECT key, value FROM env_vars ORDER BY key")
    .all() as Array<{ key: string; value: string }>;

  const appVars = allVars.filter(({ key }) =>
    appPrefixes.some((prefix) => key.startsWith(prefix))
  );

  if (appVars.length === 0) return;

  const content = appVars.map(({ key, value }) => `${key}=${value}`).join("\n") + "\n";
  writeFileSync(join(appPath, ".env.local"), content, "utf-8");
}

type ActionResult = { error: string } | { success: true } | undefined;

export async function toggleAppDeploy(
  appId: string,
  enable: boolean
): Promise<ActionResult> {
  // Admin dashboard is always enabled.
  const nextEnabled = appId === "admin" ? true : enable;
  setDeployEnabled(appId, nextEnabled);

  const row = getDb()
    .prepare("SELECT docker_service FROM apps WHERE id = ?")
    .get(appId) as { docker_service: string } | undefined;

  if (row?.docker_service && appId !== "admin") {
    try {
      if (nextEnabled) {
        await startContainer(row.docker_service);
      } else {
        await stopContainer(row.docker_service);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isNotFound =
        msg.includes("no such container") || msg.includes("404");

      if (isNotFound && nextEnabled) {
        // Container was never deployed — revert so DB stays consistent.
        setDeployEnabled(appId, false);
        revalidatePath("/");
        return { error: "No container found. Run a full deploy first." };
      }

      // For any other error, revert the DB flag to avoid DB/container divergence.
      setDeployEnabled(appId, !nextEnabled);
      revalidatePath("/");
      return { error: `Container operation failed: ${msg}` };
    }
  }

  revalidatePath("/");
  return { success: true };
}

export async function saveEnvVar(key: string, value: string) {
  setEnvVarValue(key, value);
  const appDir = getAppDirForKey(key);
  if (appDir) writeEnvLocal(appDir);
  revalidatePath("/");
}
