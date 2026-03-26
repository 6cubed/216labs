import { Octokit } from "@octokit/rest";
import {
  githubBranch,
  githubRepo,
  githubToken,
  GITHUB_OWNER,
  GITHUB_REPO_NAME,
} from "./config";
import type { Finding } from "./scanner";

let _octokit: Octokit | null = null;

function octokit(): Octokit {
  const token = githubToken();
  if (!token) {
    throw new Error("GITHUB_TOKEN required");
  }
  if (!_octokit) {
    _octokit = new Octokit({ auth: token });
  }
  return _octokit;
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

const LABEL_COLORS: Record<string, string> = {
  "security": "e11d48",
  "security:critical": "7c0d0d",
  "security:high": "dc2626",
  "security:medium": "d97706",
  "security:low": "3b82f6",
  "security:info": "6b7280",
};

export async function ensureLabels(): Promise<void> {
  for (const [name, color] of Object.entries(LABEL_COLORS)) {
    try {
      await octokit().issues.createLabel({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO_NAME,
        name,
        color,
        description:
          name === "security"
            ? "Security vulnerability"
            : `${name.split(":")[1]} severity security issue`,
      });
    } catch {
      // 422 = already exists, any other error is non-fatal (labels are cosmetic)
    }
  }
}

export async function createIssue(finding: Finding, commitSha?: string): Promise<number> {
  const emoji = SEVERITY_EMOJI[finding.severity] ?? "⚪";
  const title = `[Security] ${emoji} ${capitalize(finding.severity)}: ${finding.title} in \`${finding.filePath}\``;

  const response = await octokit().issues.create({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO_NAME,
    title,
    body: buildBody(finding, commitSha),
    labels: ["security", `security:${finding.severity}`],
  });

  return response.data.number;
}

export async function closeIssue(issueNumber: number, commitSha?: string): Promise<void> {
  const sha = commitSha ? ` (commit \`${commitSha.slice(0, 7)}\`)` : "";
  await octokit().issues.createComment({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO_NAME,
    issue_number: issueNumber,
    body: `✅ **Resolved** — PipeSecure did not detect this vulnerability in the latest scan${sha}. Closing automatically.`,
  });
  await octokit().issues.update({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO_NAME,
    issue_number: issueNumber,
    state: "closed",
    state_reason: "completed",
  });
}

function buildBody(finding: Finding, commitSha?: string): string {
  const emoji = SEVERITY_EMOJI[finding.severity] ?? "⚪";
  const fileUrl = `https://github.com/${githubRepo}/blob/${commitSha || githubBranch}/${finding.filePath}#L${finding.startLine}`;
  const scanRef = commitSha
    ? `Commit [\`${commitSha.slice(0, 7)}\`](https://github.com/${githubRepo}/commit/${commitSha})`
    : "Manual scan";
  const cweSection = finding.cweIds.length
    ? `**CWE**: ${finding.cweIds.join(", ")}  \n`
    : "";
  const codeSection = finding.codeSnippet.trim()
    ? `\n### Vulnerable Code\n\`\`\`\n${finding.codeSnippet.trim()}\n\`\`\`\n`
    : "";

  return `## ${emoji} Security Vulnerability Detected

**Severity**: \`${finding.severity.toUpperCase()}\`  
**Rule**: \`${finding.ruleId}\`  
**Tool**: ${finding.tool}  
${cweSection}**Location**: [\`${finding.filePath}\` line ${finding.startLine}](${fileUrl})

### Description

${finding.message}
${codeSection}
---
*Detected by PipeSecure · ${scanRef} · ${new Date().toISOString().split("T")[0]}*`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
