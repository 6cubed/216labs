import { revalidatePath } from "next/cache";

/** All admin UI routes — call after mutations so nested pages (e.g. /applications) are not stale. */
export function revalidateAdminPaths(): void {
  const paths = [
    "/",
    "/applications",
    "/activity",
    "/analytics",
    "/env",
    "/cron",
    "/todos",
    "/orders",
    "/architecture",
  ];
  for (const p of paths) {
    revalidatePath(p);
  }
}
