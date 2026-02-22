import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import type { SemgrepResult } from "../types";

const execAsync = promisify(exec);

function findRulesDir(): string | null {
  const candidates = [
    path.join(__dirname, "../../rules/semgrep"),
    path.resolve(process.cwd(), "src/workers/rules/semgrep"),
    path.resolve("/app/src/workers/rules/semgrep"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

export async function runSemgrepCLI(repoPath: string): Promise<SemgrepResult[]> {
  const rulesDir = findRulesDir();
  const configFlags = rulesDir
    ? `--config "p/default" --config "${rulesDir}"`
    : `--config "p/default"`;

  console.log(`[semgrep] Scanning ${repoPath} with rules from: ${rulesDir || "p/default only"}`);

  try {
    const { stdout } = await execAsync(
      `semgrep scan ${configFlags} --json --quiet "${repoPath}"`,
      {
        timeout: 300000,
        maxBuffer: 50 * 1024 * 1024,
        env: { ...process.env, SEMGREP_SEND_METRICS: "on" },
      }
    );

    const parsed = JSON.parse(stdout);
    const results = (parsed.results || []) as SemgrepResult[];
    console.log(`[semgrep] Found ${results.length} raw findings`);
    return results;
  } catch (error) {
    if (error && typeof error === "object" && "stdout" in error) {
      const stdout = (error as { stdout: string }).stdout;
      if (stdout) {
        try {
          const parsed = JSON.parse(stdout);
          const results = (parsed.results || []) as SemgrepResult[];
          console.log(`[semgrep] Found ${results.length} raw findings (non-zero exit)`);
          return results;
        } catch {
          // parse failure
        }
      }
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[semgrep] CLI scan failed: ${msg.slice(0, 500)}`);
    return [];
  }
}
