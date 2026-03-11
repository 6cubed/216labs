"use client";

import { Trophy, BarChart2 } from "lucide-react";
import type { LeaderboardRow } from "@/lib/db";

interface LeaderboardProps {
  rows: LeaderboardRow[];
  isLoading?: boolean;
}

function AccuracyBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-sm font-mono font-semibold text-slate-300 w-12 text-right">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="text-amber-400 font-bold text-sm flex items-center gap-1">
        <Trophy className="w-3.5 h-3.5" /> 1st
      </span>
    );
  if (rank === 2)
    return <span className="text-slate-400 font-bold text-sm">2nd</span>;
  if (rank === 3)
    return <span className="text-amber-700 font-bold text-sm">3rd</span>;
  return <span className="text-slate-500 font-bold text-sm">{rank}th</span>;
}

export function Leaderboard({ rows, isLoading }: LeaderboardProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <BarChart2 className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">No evaluations yet. Submit your first audio above.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">
              Rank
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Model
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Correct
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Total
            </th>
            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[160px]">
              Accuracy
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Avg Latency
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.model_id}
              className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
            >
              <td className="py-3.5 px-4">
                <RankBadge rank={i + 1} />
              </td>
              <td className="py-3.5 px-4">
                <div className="font-medium text-slate-200">{row.model_name}</div>
                <div className="text-xs text-slate-500 capitalize">{row.provider}</div>
              </td>
              <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-semibold">
                {row.correct}
              </td>
              <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                {row.total}
              </td>
              <td className="py-3.5 px-4">
                <AccuracyBar value={row.accuracy} />
              </td>
              <td className="py-3.5 px-4 text-right font-mono text-slate-400 text-xs">
                {row.avg_latency_ms ? `${(row.avg_latency_ms / 1000).toFixed(1)}s` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
