"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ModelMetrics } from "./Dashboard";

// Show top 3 best-calibrated + worst model for contrast
function selectModels(models: ModelMetrics[]) {
  const withData = models.filter(
    (m) => m.estimateCount > 0 && m.reliabilityData.length >= 2
  );
  if (withData.length === 0) return [];
  const top3 = withData.slice(0, Math.min(3, withData.length));
  const worst =
    withData.length > 3 ? [withData[withData.length - 1]] : [];
  const unique = [...top3, ...worst.filter((m) => !top3.includes(m))];
  return unique;
}

// Build chart data: merge reliability points by predicted bucket
function buildChartData(selected: ModelMetrics[]) {
  // Perfect calibration reference
  const perfPoints = Array.from({ length: 11 }, (_, i) => i / 10);

  // Collect all x-values from model data
  const xSet = new Set<number>(perfPoints);
  for (const m of selected) {
    for (const p of m.reliabilityData) {
      xSet.add(parseFloat(p.predicted.toFixed(2)));
    }
  }

  const sortedX = Array.from(xSet).sort((a, b) => a - b);

  return sortedX.map((x) => {
    const row: Record<string, number | null> = { x, perfect: x };
    for (const m of selected) {
      const match = m.reliabilityData.find(
        (p) => Math.abs(p.predicted - x) < 0.06
      );
      row[m.modelId] = match ? parseFloat(match.actual.toFixed(3)) : null;
    }
    return row;
  });
}

const CustomTooltip = ({
  active,
  payload,
  label,
  models,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
  models: ModelMetrics[];
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1426] border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <div className="text-slate-400 mb-2">
        Predicted: {Math.round((label ?? 0) * 100)}%
      </div>
      {payload.map((entry) => {
        if (entry.name === "perfect") return null;
        const model = models.find((m) => m.modelId === entry.name);
        return (
          <div key={entry.name} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span style={{ color: entry.color }}>
              {model?.modelName ?? entry.name}:
            </span>
            <span className="text-white font-mono">
              {Math.round(entry.value * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default function ReliabilityDiagram({
  models,
}: {
  models: ModelMetrics[];
}) {
  const selected = selectModels(models);

  if (selected.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
        Not enough resolved data for reliability diagram
      </div>
    );
  }

  const chartData = buildChartData(selected);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
        <XAxis
          dataKey="x"
          type="number"
          domain={[0, 1]}
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
          stroke="#334155"
          tick={{ fontSize: 10, fill: "#475569" }}
          ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
          stroke="#334155"
          tick={{ fontSize: 10, fill: "#475569" }}
          ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
        />
        <Tooltip content={<CustomTooltip models={selected} />} />
        <Legend
          wrapperStyle={{ paddingTop: "12px" }}
          formatter={(value) => {
            if (value === "perfect")
              return (
                <span style={{ color: "#334155", fontSize: 10 }}>
                  Perfect calibration
                </span>
              );
            const m = selected.find((mo) => mo.modelId === value);
            return (
              <span style={{ color: m?.color ?? "#fff", fontSize: 10 }}>
                {m?.modelName ?? value}
              </span>
            );
          }}
        />
        {/* Perfect calibration diagonal */}
        <Line
          dataKey="perfect"
          stroke="#2d3d55"
          strokeDasharray="5 5"
          dot={false}
          strokeWidth={1.5}
          type="linear"
          connectNulls
        />
        {selected.map((model) => (
          <Line
            key={model.modelId}
            dataKey={model.modelId}
            stroke={model.color}
            strokeWidth={2}
            dot={{ fill: model.color, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            type="monotone"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
