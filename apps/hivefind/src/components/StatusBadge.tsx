import { MysteryStatus } from "@/data/types";

const config: Record<MysteryStatus, { label: string; color: string; dot: string }> = {
  unsolved: { label: "Unsolved", color: "bg-red-500/10 text-red-400 border-red-500/20", dot: "bg-red-500" },
  cold_case: { label: "Cold Case", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", dot: "bg-blue-500" },
  partially_solved: { label: "Partially Solved", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", dot: "bg-amber-500" },
  solved: { label: "Solved", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-500" },
};

export function StatusBadge({ status }: { status: MysteryStatus }) {
  const { label, color, dot } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${status === "unsolved" ? "animate-pulse-dot" : ""}`} />
      {label}
    </span>
  );
}
