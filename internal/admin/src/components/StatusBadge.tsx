import type { DeploymentStatus } from "@/data/apps";

const statusConfig: Record<
  DeploymentStatus,
  { label: string; dot: string; bg: string }
> = {
  running: {
    label: "Running",
    dot: "bg-emerald-400",
    bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  stopped: {
    label: "Stopped",
    dot: "bg-slate-400",
    bg: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  },
  deploying: {
    label: "Deploying",
    dot: "bg-amber-400 animate-pulse",
    bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  error: {
    label: "Error",
    dot: "bg-red-400",
    bg: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
