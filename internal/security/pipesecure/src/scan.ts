import { scanRepo } from "./scanner";
import { issueStore, scanLog } from "./db";
import { createIssue, closeIssue, ensureLabels } from "./issues";
import { dryRunIssues, githubToken, scanTargets, type ScanTarget } from "./config";

let scanning = false;

async function syncRepo(
  target: ScanTarget,
  commitSha: string | undefined,
  dry: boolean
): Promise<{ findings: number; created: number; closed: number }> {
  const { fullName, owner, name, branch } = target;

  if (!dry) {
    await ensureLabels(owner, name);
  }

  const findings = await scanRepo(target);
  console.log(`[scan] ${fullName}: ${findings.length} potential vulnerabilities found`);

  const currentFingerprints = new Set(findings.map((f) => f.fingerprint));
  let created = 0;

  for (const finding of findings) {
    const existing = issueStore.getByFingerprint(finding.fingerprint);
    if (!existing) {
      if (dry) {
        console.log(
          `[scan] DRY_RUN would create issue: ${finding.title} (${finding.filePath}:${finding.startLine})`
        );
        created++;
        continue;
      }
      try {
        const num = await createIssue(owner, name, fullName, branch, finding, commitSha);
        issueStore.insert({
          fingerprint: finding.fingerprint,
          issue_number: num,
          rule_id: finding.ruleId,
          file_path: finding.filePath,
          title: finding.title,
          severity: finding.severity,
          github_repo: fullName,
        });
        console.log(
          `[scan] Created issue #${num} on ${fullName}: ${finding.title} (${finding.filePath}:${finding.startLine})`
        );
        created++;
      } catch (err) {
        console.error(`[scan] Failed to create issue for ${finding.fingerprint}:`, err);
      }
    } else if (existing.state === "closed") {
      if (dry) {
        console.log(`[scan] DRY_RUN would reopen issue: ${finding.title}`);
        created++;
        continue;
      }
      try {
        const num = await createIssue(owner, name, fullName, branch, finding, commitSha);
        issueStore.reopen(finding.fingerprint, num);
        console.log(`[scan] Reopened finding ${finding.fingerprint} as issue #${num}`);
        created++;
      } catch (err) {
        console.error(`[scan] Failed to reopen issue for ${finding.fingerprint}:`, err);
      }
    }
  }

  let closed = 0;
  for (const tracked of issueStore.getAllOpenForRepo(fullName)) {
    if (!currentFingerprints.has(tracked.fingerprint) && tracked.issue_number) {
      if (dry) {
        console.log(`[scan] DRY_RUN would close issue #${tracked.issue_number} on ${fullName}`);
        closed++;
        continue;
      }
      try {
        await closeIssue(owner, name, tracked.issue_number, commitSha);
        issueStore.markClosed(tracked.fingerprint);
        console.log(
          `[scan] Closed issue #${tracked.issue_number} on ${fullName}: vulnerability resolved`
        );
        closed++;
      } catch (err) {
        console.error(`[scan] Failed to close issue #${tracked.issue_number}:`, err);
      }
    }
  }

  return { findings: findings.length, created, closed };
}

export async function runScan(commitSha?: string): Promise<void> {
  if (scanning) {
    console.log("[scan] Already scanning, skipping");
    return;
  }
  if (!githubToken()) {
    console.warn("[pipesecure] GITHUB_TOKEN not set; automated scans disabled.");
    return;
  }
  scanning = true;
  const start = Date.now();
  const logId = scanLog.start();
  const dry = dryRunIssues();
  if (dry) {
    console.log("[scan] PIPESECURE_DRY_RUN enabled — no GitHub issues will be created or closed");
  }

  try {
    const targets = scanTargets();
    console.log(
      `[scan] Starting${commitSha ? ` for commit ${commitSha.slice(0, 7)}` : ""} — ${targets.length} repo(s)...`
    );

    let totalFindings = 0;
    let totalCreated = 0;
    let totalClosed = 0;

    for (const target of targets) {
      try {
        const r = await syncRepo(target, commitSha, dry);
        totalFindings += r.findings;
        totalCreated += r.created;
        totalClosed += r.closed;
      } catch (err) {
        console.error(`[scan] Failed scanning ${target.fullName}:`, err);
      }
    }

    scanLog.finish(logId, totalFindings, totalCreated, totalClosed);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[scan] Done in ${elapsed}s — ${totalFindings} findings, ${totalCreated} issues opened (or dry-run), ${totalClosed} closed`
    );
  } finally {
    scanning = false;
  }
}
