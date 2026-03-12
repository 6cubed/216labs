"use server";

import { setDeployEnabled, setEnvVarValue, getDb } from "@/lib/db";
import { startContainer, stopContainer } from "@/lib/docker";
import { revalidatePath } from "next/cache";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const PROJECTS_ROOT =
  process.env.PROJECTS_ROOT || join(process.cwd(), "..");

// Fallback when manifests aren't available (e.g. admin in isolation). Ordered longest-first.
const PREFIX_TO_DIR_FALLBACK: Array<[string, string]> = [
  ["NEXT_PUBLIC_STORYBOOK_", "apps/storybook"],
  ["STORYBOOK_", "apps/storybook"],
  ["AUDIOAICHECKUP_", "apps/audioaicheckup"],
  ["NEXT_PUBLIC_ONEFIT_", "apps/onefit"],
  ["ONEFIT_", "apps/onefit"],
  ["NEXT_PUBLIC_ONEROOM_", "apps/oneroom"],
  ["ONEROOM_", "apps/oneroom"],
  ["AGIMEMES_", "apps/agimemes.com"],
  ["PRIORS_", "apps/priors"],
  ["AGITSHIRTS_", "apps/agitshirts"],
  ["RAMBLINGRADIO_", "apps/RamblingRadio"],
  ["HIVEFIND_", "apps/hivefind"],
  ["CALIBRATEDAI_", "apps/calibratedai"],
  ["BIGLEROYS_", "apps/bigleroys"],
  ["ONEPAGE_", "apps/1pageresearch"],
  ["ZDGAME_", "apps/thezurichdatinggame"],
];

/** Build (prefix, repo_path) from DB apps + manifest env_vars. Scale: no code change for new apps. */
function getPrefixToDir(): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  const db = getDb();
  const apps = db.prepare("SELECT id, repo_path FROM apps").all() as Array<{
    id: string;
    repo_path: string;
  }>;
  for (const app of apps) {
    const manifestPath = join(PROJECTS_ROOT, app.repo_path, "manifest.json");
    if (!existsSync(manifestPath)) {
      const defaultPrefix =
        app.id.toUpperCase().replace(/-/g, "_").replace(/\./g, "_") + "_";
      entries.push([defaultPrefix, app.repo_path]);
      continue;
    }
    try {
      const manifest = JSON.parse(
        readFileSync(manifestPath, "utf-8")
      ) as { env_prefix?: string; env_vars?: Array<{ key: string }> };
      const prefixFromManifest = manifest.env_prefix
        ? manifest.env_prefix + "_"
        : null;
      const keys = manifest.env_vars?.map((v) => v.key) ?? [];
      const prefixes = new Set<string>();
      if (prefixFromManifest) prefixes.add(prefixFromManifest);
      for (const key of keys) {
        const segs = key.split("_");
        if (segs.length >= 1 && segs[0]) prefixes.add(segs[0] + "_");
        if (key.startsWith("NEXT_PUBLIC_") && segs.length >= 2)
          prefixes.add("NEXT_PUBLIC_" + segs[1] + "_");
      }
      for (const p of prefixes) entries.push([p, app.repo_path]);
    } catch {
      const defaultPrefix =
        app.id.toUpperCase().replace(/-/g, "_").replace(/\./g, "_") + "_";
      entries.push([defaultPrefix, app.repo_path]);
    }
  }
  if (entries.length === 0) return PREFIX_TO_DIR_FALLBACK;
  entries.sort((a, b) => b[0].length - a[0].length);
  return entries;
}

function getAppDirForKey(key: string): string | null {
  const prefixToDir = getPrefixToDir();
  for (const [prefix, dir] of prefixToDir) {
    if (key.startsWith(prefix)) return dir;
  }
  return null;
}

function writeEnvLocal(appDir: string): void {
  const appPath = join(PROJECTS_ROOT, appDir);
  if (!existsSync(appPath)) return;

  const prefixToDir = getPrefixToDir();
  const appPrefixes = prefixToDir
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

export async function fulfillStorybookOrder(orderId: string): Promise<ActionResult> {
  try {
    const { patchStorybookOrder } = await import("@/lib/storybook");
    await patchStorybookOrder(orderId, "fulfilled");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update order" };
  }
}

export async function saveEnvVar(key: string, value: string) {
  setEnvVarValue(key, value);
  const appDir = getAppDirForKey(key);
  if (appDir) writeEnvLocal(appDir);
  revalidatePath("/");
}

export async function fetchAppLogs(appId: string): Promise<string[]> {
  const row = getDb()
    .prepare("SELECT docker_service FROM apps WHERE id = ?")
    .get(appId) as { docker_service: string } | undefined;
  if (!row) return [];
  const { getContainerLogs } = await import("@/lib/docker");
  return getContainerLogs(row.docker_service);
}
