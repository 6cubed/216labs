import OpenAI from "openai";
import { runSemgrepCLI } from "./tools/semgrep-cli";
import { runAstGrepCLI } from "./tools/astgrep-cli";
import type { ScanFinding, SemgrepResult, AstGrepResult } from "./types";
import fs from "fs/promises";
import path from "path";

const AGENT_SYSTEM_PROMPT = `You are PipeSecure, an elite AI penetration tester. You perform thorough, contextual security assessments — not pattern matching, but real analysis like a senior pentester would.

## Core Principles

**PRECISION OVER VOLUME.** Every finding you report must be a real, exploitable vulnerability that a developer needs to act on. False positives erode trust. If you're not confident something is a genuine issue, do NOT include it.

**DO NOT report these as findings:**
- Informational style issues (missing comments, code smell)
- Dependencies that are merely outdated but have no known CVE
- "Best practice" suggestions that aren't actual vulnerabilities
- Issues in test files, mock data, or development-only code
- Theoretical attacks that require physical access or pre-existing root
- Missing CSRF protection on GET endpoints (that's correct behavior)
- Using HTTP in development/localhost configurations

## Process

1. **Triage tool findings**: Analyze each Semgrep/ast-grep result in context. Read the surrounding code, trace data flow, determine if it's exploitable. Discard false positives.

2. **Manual code review**: Look for what tools miss:
   - Broken auth/authz, privilege escalation, IDOR
   - SQL/NoSQL/command injection, SSRF, path traversal
   - Hardcoded secrets, API keys, credentials in source
   - XSS (reflected, stored, DOM-based)
   - Insecure deserialization, mass assignment
   - Race conditions, insecure crypto
   - Business logic flaws

3. **Score with CVSS 3.1**: Every finding MUST include a CVSS score and vector string. Be realistic:

   **CVSS Score Guidelines (be strict):**
   - 9.0-10.0 (Critical): Remote code execution, pre-auth SQL injection on production endpoints, hardcoded admin credentials, pre-auth auth bypass
   - 7.0-8.9 (High): Authenticated RCE, SSRF to internal services, stored XSS in admin panels, auth bypass with specific conditions
   - 4.0-6.9 (Medium): Reflected XSS, CSRF on state-changing actions, IDOR requiring auth, info disclosure of PII
   - 0.1-3.9 (Low): Self-XSS, verbose error messages, missing security headers, internal info disclosure
   - 0.0 (Info): Purely informational, no security impact

   **Common scoring mistakes to AVOID:**
   - Do NOT rate missing security headers as High/Critical — they are Low (CVSS 2.0-3.5)
   - Do NOT rate reflected XSS requiring social engineering as Critical — it's Medium (CVSS 4.0-6.0)
   - Do NOT rate issues behind authentication as if they were pre-auth
   - Do NOT rate development/debug code issues the same as production code
   - ALWAYS consider Attack Complexity, Privileges Required, and User Interaction

   **CVSS 3.1 vector format**: AV:{N|A|L|P}/AC:{L|H}/PR:{N|L|H}/UI:{N|R}/S:{U|C}/C:{N|L|H}/I:{N|L|H}/A:{N|L|H}

4. **Write actionable remediation**: Specific code fixes, not generic advice.

## Available Tools

You have tools to read files, list directories, and search code. Use them to verify findings and understand context before reporting.

## Output Format

Output a JSON array wrapped in \`\`\`json fences:

\`\`\`json
[
  {
    "title": "Brief vulnerability title",
    "description": "What it is, why it's exploitable, specific remediation with code",
    "severity": "critical|high|medium|low|info",
    "cvssScore": 7.5,
    "cvssVector": "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    "type": "sast|dom|secret|config|logic",
    "filePath": "relative/path/to/file",
    "startLine": 42,
    "endLine": 45,
    "cweId": "CWE-89",
    "tool": "semgrep|astgrep|ai-review",
    "ruleId": "rule-id-or-null",
    "confidence": "high|medium|low"
  }
]
\`\`\`

If no real vulnerabilities exist, return \`[]\`. An empty report is better than a noisy one.`;

interface ScanParams {
  repoPath: string;
  repoFullName: string;
  commitSha?: string;
  openaiApiKey: string | null;
}

// ── Tool definitions for the agent ──────────────────────────────

const AGENT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file in the repository. Returns the file content with line numbers.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path to the file from the repository root" },
          startLine: { type: "number", description: "Optional: start reading from this line (1-indexed)" },
          endLine: { type: "number", description: "Optional: stop reading at this line (inclusive)" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List files and directories at a given path in the repository.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path from repository root. Use '' or '.' for root." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Search for a pattern (regex) across the repository. Returns matching file paths and line numbers.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex pattern to search for" },
          fileGlob: { type: "string", description: "Optional: glob pattern to filter files (e.g. '*.ts', '*.py')" },
        },
        required: ["pattern"],
      },
    },
  },
];

// ── Tool implementations ────────────────────────────────────────

async function toolReadFile(repoPath: string, args: { path: string; startLine?: number; endLine?: number }): Promise<string> {
  const filePath = path.resolve(repoPath, args.path);
  if (!filePath.startsWith(path.resolve(repoPath))) {
    return "Error: Path traversal detected — access denied.";
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const start = Math.max(1, args.startLine || 1);
    const end = Math.min(lines.length, args.endLine || lines.length);
    const slice = lines.slice(start - 1, end);
    return slice.map((line, i) => `${start + i}| ${line}`).join("\n");
  } catch {
    return `Error: Could not read file "${args.path}".`;
  }
}

async function toolListDirectory(repoPath: string, args: { path: string }): Promise<string> {
  const dirPath = path.resolve(repoPath, args.path || ".");
  if (!dirPath.startsWith(path.resolve(repoPath))) {
    return "Error: Path traversal detected — access denied.";
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const filtered = entries.filter((e) => !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "__pycache__");
    return filtered
      .map((e) => `${e.isDirectory() ? "[dir]" : "[file]"} ${e.name}`)
      .join("\n");
  } catch {
    return `Error: Could not list directory "${args.path}".`;
  }
}

async function toolSearchCode(repoPath: string, args: { pattern: string; fileGlob?: string }): Promise<string> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  const globFlag = args.fileGlob ? `--glob "${args.fileGlob}"` : "";
  const cmd = `rg --line-number --no-heading --max-count 5 --max-filesize 500K ${globFlag} "${args.pattern.replace(/"/g, '\\"')}" "${repoPath}" || true`;

  try {
    const { stdout } = await execAsync(cmd, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
    if (!stdout.trim()) return "No matches found.";
    const lines = stdout.trim().split("\n");
    const relative = lines.map((l) => l.replace(repoPath + path.sep, "").replace(repoPath + "/", ""));
    return relative.slice(0, 50).join("\n") + (lines.length > 50 ? `\n... and ${lines.length - 50} more matches` : "");
  } catch {
    const grepCmd = `grep -rn --include="${args.fileGlob || "*"}" "${args.pattern.replace(/"/g, '\\"')}" "${repoPath}" || true`;
    try {
      const { stdout } = await execAsync(grepCmd, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
      if (!stdout.trim()) return "No matches found.";
      const lines = stdout.trim().split("\n");
      const relative = lines.map((l) => l.replace(repoPath + path.sep, "").replace(repoPath + "/", ""));
      return relative.slice(0, 50).join("\n");
    } catch {
      return "Search failed — grep not available.";
    }
  }
}

async function executeAgentTool(repoPath: string, name: string, argsStr: string): Promise<string> {
  const args = JSON.parse(argsStr);
  switch (name) {
    case "read_file":
      return await toolReadFile(repoPath, args);
    case "list_directory":
      return await toolListDirectory(repoPath, args);
    case "search_code":
      return await toolSearchCode(repoPath, args);
    default:
      return `Unknown tool: ${name}`;
  }
}

// ── Gather code context for flagged files ───────────────────────

async function gatherCodeContext(repoPath: string, semgrep: SemgrepResult[], astgrep: AstGrepResult[]): Promise<string> {
  const fileSet = new Set<string>();
  for (const r of semgrep) fileSet.add(r.path);
  for (const r of astgrep) fileSet.add(r.file);

  const snippets: string[] = [];
  for (const file of Array.from(fileSet).slice(0, 20)) {
    const absPath = path.resolve(repoPath, file);
    try {
      const content = await fs.readFile(absPath, "utf-8");
      const lines = content.split("\n");
      if (lines.length > 300) {
        snippets.push(`── ${file} (${lines.length} lines, showing first 300) ──\n` + lines.slice(0, 300).map((l, i) => `${i + 1}| ${l}`).join("\n"));
      } else {
        snippets.push(`── ${file} ──\n` + lines.map((l, i) => `${i + 1}| ${l}`).join("\n"));
      }
    } catch {
      // skip unreadable files
    }
  }
  return snippets.join("\n\n");
}

// ── Build repo structure summary ────────────────────────────────

async function getRepoStructure(repoPath: string, prefix = "", depth = 0): Promise<string> {
  if (depth > 3) return "";
  try {
    const entries = await fs.readdir(repoPath, { withFileTypes: true });
    const filtered = entries.filter((e) =>
      !e.name.startsWith(".") &&
      !["node_modules", "__pycache__", ".git", "dist", "build", ".next", "vendor", "venv"].includes(e.name)
    );

    const lines: string[] = [];
    for (const entry of filtered.slice(0, 40)) {
      if (entry.isDirectory()) {
        lines.push(`${prefix}${entry.name}/`);
        const sub = await getRepoStructure(path.join(repoPath, entry.name), prefix + "  ", depth + 1);
        if (sub) lines.push(sub);
      } else {
        lines.push(`${prefix}${entry.name}`);
      }
    }
    if (filtered.length > 40) lines.push(`${prefix}... and ${filtered.length - 40} more`);
    return lines.join("\n");
  } catch {
    return "";
  }
}

// ── Format raw findings for the agent ───────────────────────────

function formatSemgrepForAgent(results: SemgrepResult[]): string {
  if (results.length === 0) return "No Semgrep findings.";
  return results.map((r, i) =>
    `[Semgrep #${i + 1}] ${r.check_id}\n  File: ${r.path}:${r.start.line}-${r.end.line}\n  Severity: ${r.extra?.severity || "unknown"}\n  Message: ${r.extra?.message || "N/A"}\n  CWE: ${r.extra?.metadata?.cwe?.join(", ") || "N/A"}`
  ).join("\n\n");
}

function formatAstgrepForAgent(results: AstGrepResult[]): string {
  if (results.length === 0) return "No ast-grep findings.";
  return results.map((r, i) =>
    `[ast-grep #${i + 1}] ${r.ruleId}\n  File: ${r.file}:${r.range.start.line}-${r.range.end.line}\n  Severity: ${r.severity}\n  Message: ${r.message}`
  ).join("\n\n");
}

// ── Main agent with tool-use loop ───────────────────────────────

async function runAgentWithAI(
  params: ScanParams,
  semgrepResults: SemgrepResult[],
  astgrepResults: AstGrepResult[]
): Promise<ScanFinding[]> {
  const openai = new OpenAI({ apiKey: params.openaiApiKey! });

  const [repoStructure, codeContext] = await Promise.all([
    getRepoStructure(params.repoPath),
    gatherCodeContext(params.repoPath, semgrepResults, astgrepResults),
  ]);

  const userMessage = `## Repository: ${params.repoFullName}
${params.commitSha ? `Commit: ${params.commitSha}\n` : ""}
## Repository Structure
\`\`\`
${repoStructure}
\`\`\`

## Semgrep Scan Results (${semgrepResults.length} findings)
${formatSemgrepForAgent(semgrepResults)}

## ast-grep Scan Results (${astgrepResults.length} findings)
${formatAstgrepForAgent(astgrepResults)}

## Source Code of Flagged Files
${codeContext || "(No flagged files to show)"}

## Instructions

1. **Triage every finding above** — read the code context, determine true vs false positive, adjust severity.
2. **Explore the repository further** using the tools. Look at entry points (routes, API handlers, controllers), authentication logic, database queries, configuration files, and anywhere user input flows into sensitive operations.
3. **Identify vulnerabilities the tools missed** — especially logic flaws, auth issues, IDOR, SSRF, secrets in code, insecure configs.
4. Produce your final JSON array of confirmed findings.

Be thorough. A real pentester would spend hours on this. Use the tools to read files that look security-relevant.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  console.log(`[agent] Starting AI pentest agent for ${params.repoFullName} (${semgrepResults.length} semgrep + ${astgrepResults.length} astgrep findings as input)`);

  const MAX_ITERATIONS = 25;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: AGENT_TOOLS,
      temperature: 0.1,
      max_tokens: 16000,
    });

    const choice = response.choices[0];
    if (!choice.message) break;

    messages.push(choice.message);

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      console.log(`[agent] Iteration ${i + 1}: ${choice.message.tool_calls.length} tool call(s)`);
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type !== "function") continue;
        let result: string;
        try {
          result = await executeAgentTool(params.repoPath, toolCall.function.name, toolCall.function.arguments);
        } catch (error) {
          result = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result.slice(0, 60000),
        });
      }
      continue;
    }

    if (choice.message.content) {
      console.log(`[agent] Agent completed after ${i + 1} iterations`);
      const findings = parseAgentFindings(choice.message.content);
      if (findings.length > 0) return findings;

      console.log("[agent] No findings parsed from content, requesting structured JSON...");
      messages.push({
        role: "user",
        content: "Please output your final findings as a raw JSON array (no markdown fences, no explanation). If you found no vulnerabilities, respond with exactly: []",
      });
      continue;
    }

    break;
  }

  console.log("[agent] Requesting final JSON output...");
  try {
    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        ...messages,
        {
          role: "user",
          content: "Output ONLY a JSON array of your findings. No markdown, no explanation. Just the JSON array. If no findings, output []",
        },
      ],
      temperature: 0,
      max_tokens: 16000,
      response_format: { type: "json_object" },
    });

    const finalContent = finalResponse.choices[0]?.message?.content;
    if (finalContent) {
      console.log(`[agent] Final JSON response (first 500 chars): ${finalContent.slice(0, 500)}`);
      const parsed = extractJSON(finalContent);
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        const arr = Array.isArray(obj) ? obj : Array.isArray(obj.findings) ? obj.findings : [];
        if (Array.isArray(arr)) {
          return arr
            .filter((f): f is Record<string, unknown> => f && typeof f === "object")
            .map(mapRawToFinding);
        }
      }
    }
  } catch (error) {
    console.warn("[agent] Final JSON request failed:", error instanceof Error ? error.message : error);
  }

  console.warn("[agent] Could not extract findings from agent");
  return [];
}

// ── CLI-only fallback (no OpenAI key) ───────────────────────────

function mapSemgrepSeverity(severity?: string): string {
  switch (severity?.toUpperCase()) {
    case "ERROR": return "high";
    case "WARNING": return "medium";
    case "INFO": return "low";
    default: return "medium";
  }
}

function cliResultsToFindings(semgrep: SemgrepResult[], astgrep: AstGrepResult[]): ScanFinding[] {
  const findings: ScanFinding[] = [];

  for (const r of semgrep) {
    findings.push({
      title: r.check_id || "Semgrep Finding",
      description: r.extra?.message || "Security issue detected by Semgrep",
      severity: mapSemgrepSeverity(r.extra?.severity),
      type: "sast",
      filePath: r.path,
      startLine: r.start?.line,
      endLine: r.end?.line,
      cweId: r.extra?.metadata?.cwe?.[0] || undefined,
      tool: "semgrep",
      ruleId: r.check_id,
      confidence: r.extra?.metadata?.confidence || "medium",
      rawData: r,
    });
  }

  for (const r of astgrep) {
    findings.push({
      title: r.ruleId || "ast-grep Finding",
      description: r.message || "DOM-based vulnerability detected",
      severity: r.severity || "medium",
      type: "dom",
      filePath: r.file,
      startLine: r.range?.start?.line,
      endLine: r.range?.end?.line,
      cweId: r.cweId || undefined,
      tool: "astgrep",
      ruleId: r.ruleId,
      confidence: "medium",
      rawData: r,
    });
  }

  return findings;
}

// ── Map raw object to ScanFinding ───────────────────────────────

function mapRawToFinding(f: Record<string, unknown>): ScanFinding {
  const cvssScore = typeof f.cvssScore === "number" ? f.cvssScore : undefined;
  const cvssVector = typeof f.cvssVector === "string" ? f.cvssVector : undefined;

  let severity = String(f.severity || "medium").toLowerCase();
  if (cvssScore !== undefined) {
    if (cvssScore >= 9.0) severity = "critical";
    else if (cvssScore >= 7.0) severity = "high";
    else if (cvssScore >= 4.0) severity = "medium";
    else if (cvssScore > 0) severity = "low";
    else severity = "info";
  }

  return {
    title: String(f.title || "Unknown Finding"),
    description: String(f.description || ""),
    severity,
    type: String(f.type || "sast"),
    filePath: f.filePath ? String(f.filePath) : undefined,
    startLine: typeof f.startLine === "number" ? f.startLine : undefined,
    endLine: typeof f.endLine === "number" ? f.endLine : undefined,
    cweId: f.cweId ? String(f.cweId) : undefined,
    cvssScore,
    cvssVector,
    tool: String(f.tool || "ai-review"),
    ruleId: f.ruleId ? String(f.ruleId) : undefined,
    confidence: f.confidence ? String(f.confidence) : "medium",
    rawData: f,
  };
}

// ── Parse the agent's JSON output ───────────────────────────────

function extractJSON(content: string): unknown | null {
  const fencePatterns = [
    /```json\s*([\s\S]*?)```/,
    /```\s*([\s\S]*?)```/,
  ];
  for (const pattern of fencePatterns) {
    const match = content.match(pattern);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // try next pattern
      }
    }
  }

  const bracketMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (bracketMatch) {
    try {
      return JSON.parse(bracketMatch[0]);
    } catch {
      // continue
    }
  }

  try {
    return JSON.parse(content.trim());
  } catch {
    return null;
  }
}

function parseAgentFindings(content: string): ScanFinding[] {
  console.log(`[agent] Raw output (first 1000 chars): ${content.slice(0, 1000)}`);

  const parsed = extractJSON(content);

  if (parsed === null) {
    console.warn("[agent] Failed to extract JSON from agent output");
    console.log(`[agent] Full output length: ${content.length}`);
    return [];
  }

  const arr = Array.isArray(parsed) ? parsed : [parsed];

  return arr
    .filter((f): f is Record<string, unknown> => f && typeof f === "object")
    .map(mapRawToFinding);
}

// ── Public entry point ──────────────────────────────────────────

export async function runAgentScan(params: ScanParams): Promise<ScanFinding[]> {
  console.log(`[agent] Starting scan of ${params.repoFullName} (API key: ${params.openaiApiKey ? "yes" : "no"})`);

  const [semgrepResults, astgrepResults] = await Promise.all([
    runSemgrepCLI(params.repoPath),
    runAstGrepCLI(params.repoPath),
  ]);

  console.log(`[agent] CLI tools done: ${semgrepResults.length} semgrep, ${astgrepResults.length} astgrep findings`);

  if (params.openaiApiKey) {
    try {
      console.log("[agent] Running AI pentest agent...");
      const agentFindings = await runAgentWithAI(params, semgrepResults, astgrepResults);
      console.log(`[agent] AI agent produced ${agentFindings.length} findings`);
      return agentFindings;
    } catch (error) {
      console.error("[agent] AI agent failed, falling back to raw CLI results:", error instanceof Error ? error.message : error);
      return cliResultsToFindings(semgrepResults, astgrepResults);
    }
  }

  console.log("[agent] No OpenAI key — returning raw CLI findings");
  return cliResultsToFindings(semgrepResults, astgrepResults);
}
