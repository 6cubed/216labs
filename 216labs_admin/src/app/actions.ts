"use server";

import { setDeployEnabled, setEnvVarValue } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function toggleAppDeploy(appId: string, enabled: boolean) {
  // Never allow the admin dashboard to be disabled.
  setDeployEnabled(appId, appId === "admin" ? true : enabled);
  revalidatePath("/");
}

export async function saveEnvVar(key: string, value: string) {
  setEnvVarValue(key, value);
  revalidatePath("/");
}
