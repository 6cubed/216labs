import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface DeployConfig {
  apps: Record<string, { enabled: boolean }>;
}

function getConfigPath(): string {
  return join(process.cwd(), "..", "deploy-config.json");
}

export function readDeployConfig(): DeployConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { apps: {} };
  }
  return JSON.parse(readFileSync(configPath, "utf8"));
}

export function writeDeployConfig(config: DeployConfig): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

export function isAppEnabled(config: DeployConfig, appId: string): boolean {
  return config.apps[appId]?.enabled ?? true;
}
