import { scanRepo } from "./scanner";
import { issueStore, scanLog } from "./db";
import { createIssue, closeIssue, ensureLabels } from "./issues";
import { githubToken } from "./config";

let scanning = false;

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

  try {
    console.log(
      `[scan] Starting${commitSha ? ` for commit ${commitSha.slice(0, 7)}` : ""}...`
    );

    await ensureLabels();

    const findings = await scanRepo(commitSha);
    console.log(`[scan] ${findings.length} potential vulnerabilities found`);

    const currentFingerprints = new Set(findings.map((f) => f.fingerprint));

    let created = 0;
    for (const finding of findings) {
      const existing = issueStore.getByFingerprint(finding.fingerprint);
      if (!existing) {
        try {
          const num = await createIssue(finding, commitSha);
          issueStore.insert({
            fingerprint: finding.fingerprint,
            issue_number: num,
            rule_id: finding.ruleId,
            file_path: finding.filePath,
            title: finding.title,
            severity: finding.severity,
          });
          console.log(`[scan] Created issue #${num}: ${finding.title} (${finding.filePath}:${finding.startLine})`);
          created++;
        } catch (err) {
          console.error(`[scan] Failed to create issue for ${finding.fingerprint}:`, err);
        }
      } else if (existing.state === "closed") {
        // Vulnerability reappeared — open a fresh issue
        try {
          const num = await createIssue(finding, commitSha);
          issueStore.reopen(finding.fingerprint, num);
          console.log(`[scan] Reopened finding ${finding.fingerprint} as issue #${num}`);
          created++;
        } catch (err) {
          console.error(`[scan] Failed to reopen issue for ${finding.fingerprint}:`, err);
        }
      }
    }

    let closed = 0;
    for (const tracked of issueStore.getAllOpen()) {
      if (!currentFingerprints.has(tracked.fingerprint) && tracked.issue_number) {
        try {
          await closeIssue(tracked.issue_number, commitSha);
          issueStore.markClosed(tracked.fingerprint);
          console.log(`[scan] Closed issue #${tracked.issue_number}: vulnerability resolved`);
          closed++;
        } catch (err) {
          console.error(`[scan] Failed to close issue #${tracked.issue_number}:`, err);
        }
      }
    }

    scanLog.finish(logId, findings.length, created, closed);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[scan] Done in ${elapsed}s — ${findings.length} findings, ${created} issues opened, ${closed} closed`
    );
  } finally {
    scanning = false;
  }
}
