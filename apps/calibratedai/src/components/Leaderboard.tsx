import type { ModelMetrics } from "./Dashboard";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function BiasChip({ bias }: { bias: number }) {
  if (Math.abs(bias) < 0.03) {
    return (
      <span className="text-emerald-400 text-xs font-mono">
        ✓ calibrated
      </span>
    );
  }
  if (bias > 0) {
    return (
      <span className="text-red-400 text-xs font-mono">
        ▲ over {(bias * 100).toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="text-amber-400 text-xs font-mono">
      ▼ under {(Math.abs(bias) * 100).toFixed(1)}%
    </span>
  );
}

export default function Leaderboard({ models }: { models: ModelMetrics[] }) {
  const withData = models.filter((m) => m.estimateCount > 0);
  const noData = models.filter((m) => m.estimateCount === 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#0a1020] text-slate-500 text-xs uppercase tracking-wider">
            <th className="px-6 py-3 text-left w-12">Rank</th>
            <th className="px-4 py-3 text-left">Model</th>
            <th className="px-4 py-3 text-right">Size</th>
            <th className="px-4 py-3 text-right">
              <span title="Brier Score — lower is better">Brier ↑</span>
            </th>
            <th className="px-4 py-3 text-right hidden md:table-cell">
              <span title="Log Loss — lower is better">Log Loss</span>
            </th>
            <th className="px-4 py-3 text-right hidden md:table-cell">
              <span title="Expected Calibration Error">ECE</span>
            </th>
            <th className="px-4 py-3 text-left">Bias</th>
            <th className="px-4 py-3 text-right text-slate-600">n</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {withData.map((model) => (
            <tr
              key={model.modelId}
              className="hover:bg-[#0a1525] transition-colors"
            >
              <td className="px-6 py-4 text-center text-base">
                {MEDALS[model.rank] || (
                  <span className="text-slate-500 font-mono text-sm">
                    #{model.rank}
                  </span>
                )}
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: model.color }}
                  />
                  <div>
                    <div className="font-semibold text-white text-sm">
                      {model.modelName}
                    </div>
                    <div className="text-slate-500 text-xs">{model.provider}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-right font-mono text-slate-400 text-xs">
                {model.params}
              </td>
              <td className="px-4 py-4 text-right">
                <span className="font-mono text-white font-semibold">
                  {model.brierScore.toFixed(4)}
                </span>
              </td>
              <td className="px-4 py-4 text-right font-mono text-slate-300 text-xs hidden md:table-cell">
                {Number.isFinite(model.logLoss)
                  ? model.logLoss.toFixed(4)
                  : "—"}
              </td>
              <td className="px-4 py-4 text-right font-mono text-slate-300 text-xs hidden md:table-cell">
                {model.ece.toFixed(4)}
              </td>
              <td className="px-4 py-4">
                <BiasChip bias={model.bias} />
              </td>
              <td className="px-4 py-4 text-right font-mono text-slate-600 text-xs">
                {model.estimateCount}
              </td>
            </tr>
          ))}
          {noData.map((model) => (
            <tr key={model.modelId} className="opacity-30">
              <td className="px-6 py-3 text-slate-600 text-center">—</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: model.color }}
                  />
                  <span className="text-slate-500 text-sm">
                    {model.modelName}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-600 text-xs">
                {model.params}
              </td>
              <td
                className="px-4 py-3 text-right text-slate-600 text-xs"
                colSpan={5}
              >
                awaiting data
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
