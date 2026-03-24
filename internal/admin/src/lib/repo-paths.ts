import { existsSync } from "fs";
import { join, resolve } from "path";

/**
 * Repo root: contains `products/` and `internal/admin/package.json`.
 * Used when PROJECTS_ROOT / DATABASE_PATH are unset (local `next dev` from internal/admin).
 */
export function resolveMonorepoRootFromCwd(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 12; i++) {
    if (
      existsSync(join(dir, "products")) &&
      existsSync(join(dir, "internal", "admin", "package.json"))
    ) {
      return dir;
    }
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return join(resolve(process.cwd()), "..", "..");
}

let _cachedProjectsRoot: string | null = null;

export function getProjectsRoot(): string {
  if (process.env.PROJECTS_ROOT) return process.env.PROJECTS_ROOT;
  if (!_cachedProjectsRoot) _cachedProjectsRoot = resolveMonorepoRootFromCwd();
  return _cachedProjectsRoot;
}

let _cachedDbPath: string | null = null;

export function getDatabasePath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  if (!_cachedDbPath) _cachedDbPath = join(resolveMonorepoRootFromCwd(), "216labs.db");
  return _cachedDbPath;
}
