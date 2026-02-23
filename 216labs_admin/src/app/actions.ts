"use server";

import { readDeployConfig, writeDeployConfig } from "@/lib/deploy-config";
import { revalidatePath } from "next/cache";

export async function toggleAppDeploy(appId: string, enabled: boolean) {
  const config = readDeployConfig();
  config.apps[appId] = { enabled };
  writeDeployConfig(config);
  revalidatePath("/");
}
