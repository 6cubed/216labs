"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { ModelMetrics } from "./Dashboard";

function biasColor(bias: number) {
  if (Math.abs(bias) < 0.03) return "#10b981"; // well-calibrated
  if (bias > 0) return "#ef4444"; // overconfident
  return "#f59e0b"; // underconfident
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; bias: number } }>;
}) => {
  if (!active || !payload?.length) return null;
  const { name, bias } = payload[0].payload;
  const dir =
    Math.abs(bias) < 0.03
      ? "Well calibrated"
      : bias > 0
      ? "Overconfident"
      : "Underconfident";
  return (
    <div className="bg-[#0d1426] border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <div className="font-semibold text-white mb-1">{name}</div>
      <div style={{ color: biasColor(bias) }}>
        {dir}: {bias > 0 ? "+" : ""}
        {(bias * 100).toFixed(2)}%
      </div>
    </div>
  );
};

export default function CalibrationBiasChart({
  models,
}: {
  models: ModelMetrics[];
}) {
  const withData = models.filter((m) => m.estimateCount > 0);

  if (withData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
        No calibration data available
      </div>
    );
  }

  const chartData = withData.map((m) => ({
    name: m.modelName,
    shortName: m.params,
    bias: parseFloat((m.bias * 100).toFixed(3)),
  }));

  const maxAbs = Math.max(...chartData.map((d) => Math.abs(d.bias)), 5);
  const domain: [number, number] = [
    -Math.ceil(maxAbs * 1.2),
    Math.ceil(maxAbs * 1.2),
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1a2540"
          horizontal={false}
        />
        <XAxis
          type="number"
          domain={domain}
          stroke="#334155"
          tick={{ fontSize: 10, fill: "#475569" }}
          tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#334155"
          tick={{ fontSize: 10, fill: "#64748b" }}
          width={100}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine x={0} stroke="#334155" strokeWidth={1.5} />
        <Bar dataKey="bias" radius={[0, 3, 3, 0]} maxBarSize={20}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={biasColor(entry.bias / 100)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
