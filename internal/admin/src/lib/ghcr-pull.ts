/**
 * Compose services droplet GHCR sync skips (edge / proxy).
 * Mirrors default `SYNC_EXCLUDE_SERVICES` in scripts/droplet-ghcr-sync.sh.
 */
const GHCR_SYNC_EXCLUDED = new Set(["caddy", "activator"]);

export function isGhcrSyncExcludedService(dockerService: string): boolean {
  return GHCR_SYNC_EXCLUDED.has(dockerService.trim().toLowerCase());
}

export function canPullGhcrFromAdmin(dockerService: string): boolean {
  return !isGhcrSyncExcludedService(dockerService);
}
