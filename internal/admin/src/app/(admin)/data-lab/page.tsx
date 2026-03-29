import { MetricCard } from "@/components/MetricCard";
import { getDataJobsConfig, getRecentDataJobRuns } from "@/lib/data-lab";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeClass(state: string): string {
  const normalized = state.toLowerCase();
  if (normalized === "success") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
  if (normalized === "failure" || normalized === "cancelled") {
    return "bg-rose-500/10 text-rose-400 border-rose-500/25";
  }
  return "bg-amber-500/10 text-amber-300 border-amber-500/25";
}

export default async function DataLabPage() {
  const jobs = getDataJobsConfig();
  const { runs: recentRuns, note: runsNote } = await getRecentDataJobRuns(12);
  const activeJobs = jobs.filter((j) => j.status.toLowerCase() === "active").length;
  const lastRun = recentRuns[0];
  const healthyRuns = recentRuns.filter((r) => r.state.toLowerCase() === "success").length;

  return (
    <>
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Data Lab</h2>
        <p className="text-sm text-muted mt-1">
          MVP data engineering showroom: run scrape and transform jobs in CI, publish compact
          artifacts, keep the droplet clean.
        </p>
        {runsNote ? (
          <p className="text-sm text-amber-400/90 mt-2 border border-amber-500/20 rounded-md px-3 py-2 bg-amber-500/5">
            {runsNote}
          </p>
        ) : null}
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Jobs" value={jobs.length} sublabel={`${activeJobs} active`} />
        <MetricCard label="Recent Runs" value={recentRuns.length} sublabel="From GitHub Actions" />
        <MetricCard label="Successful Runs" value={healthyRuns} sublabel="Recent window" />
        <MetricCard
          label="Last Run"
          value={lastRun ? formatDate(lastRun.startedAt) : "n/a"}
          sublabel={lastRun ? lastRun.state : "No runs yet"}
        />
      </section>

      <section className="mt-8 rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Configured Data Jobs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-2">Job</th>
                <th className="text-left px-4 py-2">Schedule</th>
                <th className="text-left px-4 py-2">Owner</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{job.name}</p>
                    <p className="text-xs text-muted mt-1">{job.description}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{job.schedule}</td>
                  <td className="px-4 py-3 text-muted">{job.owner}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-muted">
                    No job definitions found in `internal/data-jobs/jobs.json`.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Recent Data Job Runs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-2">Started</th>
                <th className="text-left px-4 py-2">State</th>
                <th className="text-left px-4 py-2">Title</th>
                <th className="text-left px-4 py-2">Actor</th>
                <th className="text-left px-4 py-2">Link</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr key={run.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 text-muted">{formatDate(run.startedAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(
                        run.state,
                      )}`}
                    >
                      {run.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{run.title}</td>
                  <td className="px-4 py-3 text-muted">{run.actor}</td>
                  <td className="px-4 py-3">
                    <a
                      href={run.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
              {recentRuns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-5 text-muted">
                    {runsNote ?? "No workflow runs loaded."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
