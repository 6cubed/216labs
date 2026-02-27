"use client";

import { CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";

interface ModelResultCardProps {
  modelName: string;
  provider: string;
  rawAnswer: string | null;
  isCorrect: boolean;
  latencyMs: number;
  error: string | null;
  expectedAnswer: string;
  isPending?: boolean;
}

function ProviderBadge({ provider }: { provider: string }) {
  const styles: Record<string, string> = {
    openai: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    gemini: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const labels: Record<string, string> = {
    openai: "OpenAI",
    gemini: "Google",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-md border text-xs font-medium ${styles[provider] ?? "bg-slate-700 text-slate-400 border-slate-600"}`}
    >
      {labels[provider] ?? provider}
    </span>
  );
}

export function ModelResultCard({
  modelName,
  provider,
  rawAnswer,
  isCorrect,
  latencyMs,
  error,
  expectedAnswer,
  isPending = false,
}: ModelResultCardProps) {
  if (isPending) {
    return (
      <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/40 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-slate-700 rounded w-32" />
          <div className="h-5 bg-slate-700 rounded w-16" />
        </div>
        <div className="h-3 bg-slate-700 rounded w-full mb-2" />
        <div className="h-3 bg-slate-700 rounded w-2/3" />
      </div>
    );
  }

  const statusIcon = error ? (
    <AlertCircle className="w-5 h-5 text-amber-400" />
  ) : isCorrect ? (
    <CheckCircle className="w-5 h-5 text-emerald-400" />
  ) : (
    <XCircle className="w-5 h-5 text-red-400" />
  );

  const cardBorder = error
    ? "border-amber-500/20"
    : isCorrect
    ? "border-emerald-500/20"
    : "border-red-500/20";

  const cardBg = error
    ? "bg-amber-500/5"
    : isCorrect
    ? "bg-emerald-500/5"
    : "bg-red-500/5";

  return (
    <div className={`p-4 rounded-xl border ${cardBorder} ${cardBg} space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-200 text-sm">{modelName}</span>
          <ProviderBadge provider={provider} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusIcon}
          <span
            className={`text-xs font-bold uppercase tracking-wide ${
              error ? "text-amber-400" : isCorrect ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {error ? "Error" : isCorrect ? "Correct" : "Wrong"}
          </span>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-amber-400/80 font-mono bg-amber-500/10 px-3 py-2 rounded-lg">
          {error}
        </p>
      ) : (
        <div className="space-y-2">
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wide">Model answered</span>
            <p className="mt-0.5 text-sm text-slate-200 font-medium">
              {rawAnswer || <span className="text-slate-500 italic">No response</span>}
            </p>
          </div>
          {!isCorrect && rawAnswer && (
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wide">Expected</span>
              <p className="mt-0.5 text-sm text-emerald-400 font-medium">{expectedAnswer}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-slate-600">
        <Clock className="w-3 h-3" />
        <span>{(latencyMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
