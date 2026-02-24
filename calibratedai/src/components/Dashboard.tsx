"use client";

import { useState, useEffect, useCallback } from "react";
import Leaderboard from "./Leaderboard";
import ReliabilityDiagram from "./ReliabilityDiagram";
import CalibrationBiasChart from "./CalibrationBiasChart";
import EventsTable from "./EventsTable";

interface Stats {
  totalEvents: number;
  resolvedEvents: number;
  totalEstimates: number;
  lastFetched: string | null;
}

interface RefreshStatus {
  isRunning: boolean;
  phase: string;
  total: number;
  completed: number;
  errors: number;
  message: string;
}

export interface ModelMetrics {
  modelId: string;
  modelName: string;
  params: string;
  provider: string;
  color: string;
  brierScore: number;
  logLoss: number;
  ece: number;
  bias: number;
  estimateCount: number;
  reliabilityData: Array<{
    midpoint: number;
    predicted: number;
    actual: number;
    count: number;
  }>;
  rank: number;
}

export interface EventWithEstimates {
  id: string;
  question: string;
  marketProbability: number | null;
  outcome: number | null;
  isResolved: boolean;
  volume: number;
  estimates: Array<{
    modelId: string;
    modelName: string;
    probability: number;
  }>;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#0d1426] border border-slate-800 rounded-xl p-4">
      <div className="text-2xl font-bold font-mono text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-slate-400 text-xs mt-1">{label}</div>
    </div>
  );
}

export default function Dashboard({ initialStats }: { initialStats: Stats }) {
  const [calibration, setCalibration] = useState<{
    models: ModelMetrics[];
    stats: Stats;
  } | null>(null);
  const [events, setEvents] = useState<EventWithEstimates[]>([]);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [status, setStatus] = useState<RefreshStatus>({
    isRunning: false,
    phase: "idle",
    total: 0,
    completed: 0,
    errors: 0,
    message:
      initialStats.totalEvents > 0
        ? "Data loaded from cache"
        : "No data yet — click Refresh to begin",
  });

  const fetchData = useCallback(async () => {
    try {
      const [calRes, eventsRes] = await Promise.all([
        fetch("/api/calibration"),
        fetch("/api/events"),
      ]);
      if (calRes.ok) {
        const cal = await calRes.json();
        setCalibration(cal);
        if (cal.stats) setStats(cal.stats);
      }
      if (eventsRes.ok) {
        setEvents(await eventsRes.json());
      }
    } catch (e) {
      console.error("Failed to fetch data:", e);
    }
  }, []);

  // Load data on mount if we have estimates
  useEffect(() => {
    if (initialStats.totalEstimates > 0) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll while refresh is running
  useEffect(() => {
    if (!status.isRunning) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/status");
        const newStatus: RefreshStatus = await res.json();
        setStatus(newStatus);
        if (!newStatus.isRunning) {
          clearInterval(interval);
          await fetchData();
        }
      } catch {
        // ignore poll errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [status.isRunning, fetchData]);

  const handleRefresh = async () => {
    if (status.isRunning) return;
    const res = await fetch("/api/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventCount: 100 }),
    });
    const newStatus = await res.json();
    setStatus(newStatus);
  };

  const progress =
    status.total > 0
      ? Math.round((status.completed / status.total) * 100)
      : 0;

  const rankedModels = calibration?.models ?? [];
  const hasData =
    stats.totalEstimates > 0 ||
    rankedModels.some((m) => m.estimateCount > 0);

  return (
    <div className="min-h-screen bg-[#070c18]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0a1020] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-blue-400 text-2xl">⚖</span>
              CalibratedAI
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Do AI models know what they don&apos;t know? 10 models on 100
              Polymarket events.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {status.isRunning && (
              <span className="text-xs text-slate-400 hidden sm:block">
                {status.total > 0
                  ? `${status.completed}/${status.total}`
                  : "Loading..."}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={status.isRunning}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
            >
              {status.isRunning ? `${progress}% ···` : "Refresh Data"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Events Fetched" value={stats.totalEvents} />
          <StatCard
            label="Resolved Events"
            value={stats.resolvedEvents}
          />
          <StatCard
            label="Model Estimates"
            value={stats.totalEstimates}
          />
          <StatCard label="Models Compared" value={10} />
        </div>

        {/* Progress / Status banner */}
        {(status.isRunning ||
          (status.phase !== "idle" && status.phase !== "done")) && (
          <div className="bg-[#0d1426] border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              {status.isRunning && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
              )}
              <span className="text-sm text-slate-300">{status.message}</span>
              {status.errors > 0 && (
                <span className="text-xs text-red-400 ml-auto">
                  {status.errors} errors
                </span>
              )}
            </div>
            {status.isRunning && status.total > 0 && (
              <div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {status.completed} / {status.total} estimates
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!hasData && !status.isRunning && (
          <div className="text-center py-20 border border-dashed border-slate-700 rounded-xl bg-[#0a0f1e]">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-xl font-semibold text-white mb-2">
              No Data Yet
            </h2>
            <p className="text-slate-400 mb-6 max-w-lg mx-auto text-sm leading-relaxed">
              Fetches 100 Polymarket prediction events, then asks 10 models
              (Qwen 0.5B → GPT-4o Mini) to estimate each probability.
              Calibration metrics are computed against resolved outcomes.
            </p>
            <button
              onClick={handleRefresh}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
            >
              Fetch &amp; Evaluate →
            </button>
            <p className="text-slate-600 text-xs mt-3">
              Requires CALIBRATEDAI_OPENROUTER_API_KEY · ~1000 API calls
            </p>
          </div>
        )}

        {/* Leaderboard */}
        {rankedModels.length > 0 &&
          rankedModels.some((m) => m.estimateCount > 0) && (
            <div className="bg-[#0d1426] border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-white">
                  Calibration Leaderboard
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Ranked by Brier Score on resolved Polymarket outcomes — lower
                  is better calibrated
                </p>
              </div>
              <Leaderboard models={rankedModels} />
            </div>
          )}

        {/* Charts */}
        {rankedModels.length > 0 &&
          rankedModels.some((m) => m.estimateCount > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#0d1426] border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-1">
                  Reliability Diagram
                </h2>
                <p className="text-slate-400 text-xs mb-5">
                  Predicted probability vs actual outcome frequency. The dashed
                  diagonal is perfect calibration.
                </p>
                <ReliabilityDiagram models={rankedModels} />
              </div>
              <div className="bg-[#0d1426] border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-1">
                  Confidence Bias
                </h2>
                <p className="text-slate-400 text-xs mb-5">
                  Average over/under-confidence per model. Positive =
                  overconfident (guesses too high).
                </p>
                <CalibrationBiasChart models={rankedModels} />
              </div>
            </div>
          )}

        {/* Events table */}
        {events.length > 0 && (
          <div className="bg-[#0d1426] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">
                Event Browser
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Model probability estimates vs Polymarket market price and
                actual resolved outcome
              </p>
            </div>
            <EventsTable events={events} models={rankedModels} />
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-slate-700 text-xs py-4 space-y-1">
          <div>
            Data from{" "}
            <span className="text-slate-500">Polymarket Gamma API</span> ·
            Models via{" "}
            <span className="text-slate-500">OpenRouter</span> · Part of the{" "}
            <span className="text-slate-500">216labs</span> portfolio
          </div>
          {stats.lastFetched && (
            <div className="text-slate-600">
              Last updated:{" "}
              {new Date(stats.lastFetched).toLocaleString()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
