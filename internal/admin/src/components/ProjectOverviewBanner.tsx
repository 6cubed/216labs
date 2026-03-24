import { getProjectsRoot } from "@/lib/repo-paths";

export function ProjectOverviewBanner({
  appCount,
  renderedAtIso,
}: {
  appCount: number;
  renderedAtIso: string;
}) {
  const root = getProjectsRoot();
  const t = new Date(renderedAtIso);
  const when = Number.isNaN(t.getTime())
    ? renderedAtIso
    : t.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

  return (
    <div className="rounded-xl border border-border bg-surface-light/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[13px]">
      <div>
        <span className="text-foreground font-medium">{appCount} applications</span>
        <span className="text-muted"> · registry synced from disk + SQLite on this request</span>
      </div>
      <div className="text-xs text-muted font-mono break-all">
        <span className="text-muted">Projects root: </span>
        <span className="text-foreground/90">{root}</span>
        <span className="block sm:inline sm:ml-3 mt-1 sm:mt-0">
          Rendered: {when}
        </span>
      </div>
    </div>
  );
}
