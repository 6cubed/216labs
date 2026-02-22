import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import type { AstGrepResult } from "../types";

const execAsync = promisify(exec);

function findRulesDir(): string | null {
  const candidates = [
    path.join(__dirname, "../../rules/astgrep"),
    path.resolve(process.cwd(), "src/workers/rules/astgrep"),
    path.resolve("/app/src/workers/rules/astgrep"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

export async function runAstGrepCLI(repoPath: string): Promise<AstGrepResult[]> {
  const rulesDir = findRulesDir();
  if (!rulesDir) {
    console.warn("[astgrep] No rules directory found in any search path, skipping");
    return [];
  }

  const ruleFiles = await fsp.readdir(rulesDir);
  const yamlFiles = ruleFiles.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  if (yamlFiles.length === 0) {
    console.warn("[astgrep] Rules directory exists but contains no YAML files");
    return [];
  }

  console.log(`[astgrep] Scanning ${repoPath} with ${yamlFiles.length} rules from: ${rulesDir}`);

  const results: AstGrepResult[] = [];

  for (const ruleFile of yamlFiles) {
    try {
      const rulePath = path.join(rulesDir, ruleFile);
      const { stdout } = await execAsync(
        `ast-grep scan --rule "${rulePath}" --json "${repoPath}"`,
        {
          timeout: 120000,
          maxBuffer: 50 * 1024 * 1024,
        }
      );

      if (!stdout.trim()) continue;

      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed)) {
        for (const match of parsed) {
          results.push({
            ruleId: match.ruleId || ruleFile.replace(/\.(yml|yaml)$/, ""),
            message: match.message || "Pattern match found",
            severity: match.severity || "medium",
            file: match.file || match.path || "",
            range: match.range || {
              start: { line: match.start?.line || 0, column: match.start?.column || 0 },
              end: { line: match.end?.line || 0, column: match.end?.column || 0 },
            },
            cweId: match.cweId,
          });
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[astgrep] Rule ${ruleFile} failed: ${msg.slice(0, 200)}`);
    }
  }

  console.log(`[astgrep] Found ${results.length} raw findings`);
  return results;
}
