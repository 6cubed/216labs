import { execSync, spawnSync } from "child_process";
import { mkdtempSync, rmSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import crypto from "crypto";
import type { ScanTarget } from "./config";
import { githubToken } from "./config";

export interface Finding {
  fingerprint: string;
  ruleId: string;
  title: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  filePath: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  tool: "semgrep" | "ast-grep";
  cweIds: string[];
}

const SEVERITY_MAP: Record<string, Finding["severity"]> = {
  CRITICAL: "critical",
  ERROR: "high",
  HIGH: "high",
  WARNING: "medium",
  MEDIUM: "medium",
  INFO: "low",
  LOW: "low",
};

const RULES_DIR = join(__dirname, "rules");

export function makeFingerprint(
  repoFullName: string,
  ruleId: string,
  filePath: string,
  startLine: number
): string {
  return crypto
    .createHash("sha256")
    .update(`${repoFullName}|${ruleId}|${filePath}|${startLine}`)
    .digest("hex")
    .slice(0, 16);
}

export async function scanRepo(target: ScanTarget): Promise<Finding[]> {
  const token = githubToken();
  if (!token) {
    console.warn("[scanner] GITHUB_TOKEN not set; skipping clone and scan");
    return [];
  }

  const { fullName, branch } = target;
  const cloneUrl = `https://x-access-token:${token}@github.com/${fullName}.git`;
  const tmpDir = mkdtempSync(join(tmpdir(), "pipesecure-"));

  console.log(`[scanner] Cloning ${fullName}@${branch}...`);

  try {
    execSync(`git clone --depth 1 --branch ${branch} ${cloneUrl} ${tmpDir}`, {
      stdio: "pipe",
      timeout: 120_000,
    });

    const findings: Finding[] = [
      ...runSemgrep(tmpDir, fullName),
      ...runAstGrep(tmpDir, fullName),
    ];

    const seen = new Set<string>();
    return findings.filter((f) => {
      if (seen.has(f.fingerprint)) return false;
      seen.add(f.fingerprint);
      return true;
    });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function runSemgrep(repoDir: string, repoFullName: string): Finding[] {
  const semgrepRulesDir = join(RULES_DIR, "semgrep");

  const result = spawnSync(
    "semgrep",
    ["--config", semgrepRulesDir, "--json", "--no-rewrite-rule-ids", repoDir],
    { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024, timeout: 180_000 }
  );

  if (result.error) {
    console.error("[scanner] semgrep spawn error:", result.error.message);
    return [];
  }

  const stdout = result.stdout?.trim();
  if (!stdout) return [];

  try {
    const output = JSON.parse(stdout);
    return (output.results || []).map((r: any): Finding => {
      const filePath = r.path.replace(repoDir + "/", "").replace(repoDir, "");
      return {
        fingerprint: makeFingerprint(
          repoFullName,
          r.check_id,
          filePath,
          r.start?.line || 0
        ),
        ruleId: r.check_id,
        title: titleFromRuleId(r.check_id),
        message: r.extra?.message || "",
        severity: SEVERITY_MAP[r.extra?.severity?.toUpperCase()] ?? "medium",
        filePath,
        startLine: r.start?.line || 0,
        endLine: r.end?.line || 0,
        codeSnippet: r.extra?.lines || "",
        tool: "semgrep",
        cweIds: r.extra?.metadata?.cwe || [],
      };
    });
  } catch (err) {
    console.error("[scanner] semgrep JSON parse error:", err);
    return [];
  }
}

function runAstGrep(repoDir: string, repoFullName: string): Finding[] {
  const astgrepRulesDir = join(RULES_DIR, "astgrep");
  const findings: Finding[] = [];

  let ruleFiles: string[];
  try {
    ruleFiles = readdirSync(astgrepRulesDir)
      .filter((f) => f.endsWith(".yml"))
      .map((f) => join(astgrepRulesDir, f));
  } catch {
    return [];
  }

  for (const ruleFile of ruleFiles) {
    const result = spawnSync(
      "ast-grep",
      ["scan", "--rule", ruleFile, "--json", repoDir],
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, timeout: 60_000 }
    );

    if (result.error || !result.stdout?.trim()) continue;

    try {
      const items: any[] = JSON.parse(result.stdout);
      for (const r of items) {
        const filePath = (r.file || "").replace(repoDir + "/", "").replace(repoDir, "");
        findings.push({
          fingerprint: makeFingerprint(
            repoFullName,
            r.ruleId || ruleFile,
            filePath,
            r.range?.start?.line || 0
          ),
          ruleId: r.ruleId || ruleFile,
          title: titleFromRuleId(r.ruleId || ruleFile),
          message: r.message || "",
          severity: SEVERITY_MAP[r.severity?.toUpperCase()] ?? "medium",
          filePath,
          startLine: r.range?.start?.line || 0,
          endLine: r.range?.end?.line || 0,
          codeSnippet: r.text || "",
          tool: "ast-grep",
          cweIds: [],
        });
      }
    } catch {
      continue;
    }
  }

  return findings;
}

function titleFromRuleId(ruleId: string): string {
  const lastSegment = ruleId.split(".").pop() || ruleId;
  return lastSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
