"use server";

import { setDeployEnabled, setEnvVarValue, getDb } from "@/lib/db";
import { startContainer, stopContainer } from "@/lib/docker";
import { revalidatePath } from "next/cache";

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
  revalidatePath("/");
}
