"use server";

import { setDeployEnabled } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function toggleAppDeploy(appId: string, enabled: boolean) {
  setDeployEnabled(appId, enabled);
  revalidatePath("/");
}
