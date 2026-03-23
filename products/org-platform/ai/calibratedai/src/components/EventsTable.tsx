import type { EventWithEstimates, ModelMetrics } from "./Dashboard";

function pct(v: number | null | undefined) {
  if (v == null) return <span className="text-slate-600">—</span>;
  return <span>{Math.round(v * 100)}%</span>;
}

function diffClass(prob: number | null | undefined, outcome: number | null) {
  if (prob == null || outcome == null) return "text-slate-500";
  const diff = Math.abs(prob - outcome);
  if (diff < 0.2) return "text-emerald-400";
  if (diff < 0.4) return "text-amber-400";
  return "text-red-400";
}

export default function EventsTable({
  events,
  models,
}: {
  events: EventWithEstimates[];
  models: ModelMetrics[];
}) {
  const displayed = events.slice(0, 25);
  // Show top 5 ranked models
  const topModels = models
    .filter((m) => m.estimateCount > 0)
    .slice(0, 5);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#0a1020] text-slate-500 uppercase tracking-wider text-[10px]">
            <th className="px-6 py-3 text-left min-w-[240px]">Question</th>
            <th className="px-3 py-3 text-right whitespace-nowrap">
              Market
            </th>
            <th className="px-3 py-3 text-right">Outcome</th>
            {topModels.map((m) => (
              <th
                key={m.modelId}
                className="px-3 py-3 text-right whitespace-nowrap"
                style={{ color: m.color }}
              >
                {m.params}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {displayed.map((event) => {
            const estimateMap = new Map(
              event.estimates.map((e) => [e.modelId, e.probability])
            );
            return (
              <tr
                key={event.id}
                className="hover:bg-[#0a1525] transition-colors"
              >
                <td className="px-6 py-3 text-slate-300">
                  <p className="line-clamp-2 leading-relaxed max-w-xs">
                    {event.question}
                  </p>
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-300">
                  {pct(event.marketProbability)}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {event.isResolved ? (
                    event.outcome === 1 ? (
                      <span className="text-emerald-400 font-semibold">YES</span>
                    ) : (
                      <span className="text-red-400 font-semibold">NO</span>
                    )
                  ) : (
                    <span className="text-blue-400/60">live</span>
                  )}
                </td>
                {topModels.map((m) => {
                  const prob = estimateMap.get(m.modelId) ?? null;
                  return (
                    <td
                      key={m.modelId}
                      className={`px-3 py-3 text-right font-mono ${diffClass(prob, event.outcome)}`}
                    >
                      {pct(prob)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {events.length > 25 && (
        <div className="px-6 py-3 text-slate-600 text-xs border-t border-slate-800">
          Showing 25 of {events.length} events
        </div>
      )}
    </div>
  );
}
