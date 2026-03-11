"use client";

import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { SubmissionWithEvaluations } from "@/lib/db";

interface RecentSubmissionsProps {
  submissions: SubmissionWithEvaluations[];
}

function RelativeTime({ dateStr }: { dateStr: string }) {
  const diff = Math.floor((Date.now() - new Date(dateStr + "Z").getTime()) / 1000);
  if (diff < 60) return <span>{diff}s ago</span>;
  if (diff < 3600) return <span>{Math.floor(diff / 60)}m ago</span>;
  if (diff < 86400) return <span>{Math.floor(diff / 3600)}h ago</span>;
  return <span>{new Date(dateStr).toLocaleDateString()}</span>;
}

function SubmissionRow({ sub }: { sub: SubmissionWithEvaluations }) {
  const [open, setOpen] = useState(false);
  const correctCount = sub.evaluations.filter((e) => e.is_correct && !e.error).length;
  const totalCount = sub.evaluations.filter((e) => !e.error).length;

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/30 transition-colors"
      >
        <span className="text-slate-500 shrink-0">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 truncate">{sub.question}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Expected: <span className="text-slate-400">{sub.expected_answer}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono text-slate-500">
            {correctCount}/{totalCount} correct
          </span>
          <span className="text-xs text-slate-600">
            <RelativeTime dateStr={sub.created_at} />
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sub.evaluations.map((ev) => (
            <div key={ev.id} className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/40">
              <div className="mt-0.5 shrink-0">
                {ev.error ? (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                ) : ev.is_correct ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300">{ev.model_name}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {ev.error ? (
                    <span className="text-amber-400/70">{ev.error}</span>
                  ) : (
                    ev.raw_answer ?? "—"
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecentSubmissions({ submissions }: RecentSubmissionsProps) {
  if (submissions.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-8">
        No submissions yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {submissions.map((sub) => (
        <SubmissionRow key={sub.id} sub={sub} />
      ))}
    </div>
  );
}
