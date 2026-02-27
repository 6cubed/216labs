"use client";

import { useState, useCallback } from "react";
import { Mic2, Send, RotateCcw, FlaskConical, Loader2 } from "lucide-react";
import { AudioRecorder } from "@/components/AudioRecorder";
import { ModelResultCard } from "@/components/ModelResultCard";
import { Leaderboard } from "@/components/Leaderboard";
import { RecentSubmissions } from "@/components/RecentSubmissions";
import type { LeaderboardRow, SubmissionWithEvaluations } from "@/lib/db";

interface EvaluationResult {
  modelId: string;
  modelName: string;
  provider: string;
  rawAnswer: string | null;
  isCorrect: boolean;
  latencyMs: number;
  error: string | null;
}

interface EvaluateResponse {
  submissionId: number;
  question: string;
  expectedAnswer: string;
  results: EvaluationResult[];
}

type Tab = "evaluate" | "leaderboard";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{title}</h2>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm"
      />
      {hint && <p className="text-xs text-slate-600">{hint}</p>}
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("evaluate");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentResult, setCurrentResult] = useState<EvaluateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionWithEvaluations[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardLoaded, setLeaderboardLoaded] = useState(false);

  const handleAudioReady = useCallback((blob: Blob | null, mimeType: string) => {
    setAudioBlob(blob);
    setAudioMimeType(mimeType);
    setCurrentResult(null);
    setError(null);
  }, []);

  const canSubmit = audioBlob && question.trim() && expectedAnswer.trim() && !isEvaluating;

  const handleEvaluate = async () => {
    if (!canSubmit) return;
    setIsEvaluating(true);
    setCurrentResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob!, "recording.webm");
      formData.append("question", question.trim());
      formData.append("expected_answer", expectedAnswer.trim());

      const res = await fetch("/api/evaluate", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Evaluation failed");
      setCurrentResult(data as EvaluateResponse);
      setLeaderboardLoaded(false); // invalidate cached leaderboard
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleReset = () => {
    setAudioBlob(null);
    setAudioMimeType("");
    setQuestion("");
    setExpectedAnswer("");
    setCurrentResult(null);
    setError(null);
  };

  const loadLeaderboard = async () => {
    if (leaderboardLoaded) return;
    setLeaderboardLoading(true);
    try {
      const [lbRes, subRes] = await Promise.all([
        fetch("/api/leaderboard"),
        fetch("/api/submissions"),
      ]);
      const lbData = await lbRes.json();
      const subData = await subRes.json();
      setLeaderboard(lbData.leaderboard ?? []);
      setSubmissions(subData.submissions ?? []);
      setLeaderboardLoaded(true);
    } catch {
      // silently fail — user can retry
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (t === "leaderboard") loadLeaderboard();
  };

  const modelCount = 3;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
            <Mic2 className="w-4 h-4 text-brand-400" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 leading-none">Audio AI Checkup</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Benchmark multimodal LLMs on audio classification
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-slate-600 font-mono bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
            {modelCount} models compared
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
          {(["evaluate", "leaderboard"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? "bg-brand-500/20 text-brand-300 border border-brand-500/20"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "evaluate" ? "New Evaluation" : "Leaderboard"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* EVALUATE TAB */}
        {tab === "evaluate" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: record + form */}
              <div className="space-y-4">
                <Section title="1 — Provide Audio">
                  <AudioRecorder onAudioReady={handleAudioReady} />
                </Section>

                <Section title="2 — Set the Question">
                  <InputField
                    label="Question"
                    value={question}
                    onChange={setQuestion}
                    placeholder='e.g. "What language is the speaker using?"'
                    hint="Ask something with a single, clear, verifiable answer."
                  />
                  <InputField
                    label="Expected answer"
                    value={expectedAnswer}
                    onChange={setExpectedAnswer}
                    placeholder='e.g. "Spanish"'
                    hint="Keep it concise — models are compared by exact match (case-insensitive)."
                  />
                </Section>

                <div className="flex gap-3">
                  <button
                    onClick={handleEvaluate}
                    disabled={!canSubmit}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/20 disabled:shadow-none"
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Evaluating models…
                      </>
                    ) : (
                      <>
                        <FlaskConical className="w-4 h-4" />
                        Run Evaluation
                      </>
                    )}
                  </button>
                  {(currentResult || audioBlob) && (
                    <button
                      onClick={handleReset}
                      className="p-3 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                      title="Start over"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {error && (
                  <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </div>

              {/* Right: results */}
              <div className="space-y-4">
                <Section title="3 — Model Results">
                  {!currentResult && !isEvaluating && (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                      <Send className="w-8 h-8 mb-3 opacity-30" />
                      <p className="text-sm text-center">
                        Results will appear here after you run an evaluation.
                      </p>
                    </div>
                  )}

                  {isEvaluating && (
                    <div className="space-y-3">
                      {Array.from({ length: modelCount }).map((_, i) => (
                        <ModelResultCard
                          key={i}
                          modelName=""
                          provider=""
                          rawAnswer={null}
                          isCorrect={false}
                          latencyMs={0}
                          error={null}
                          expectedAnswer=""
                          isPending
                        />
                      ))}
                    </div>
                  )}

                  {currentResult && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                        <div className="text-xs text-slate-500">
                          <span className="text-slate-400 font-medium">Q: </span>
                          {currentResult.question}
                        </div>
                      </div>
                      {currentResult.results.map((r) => (
                        <ModelResultCard
                          key={r.modelId}
                          modelName={r.modelName}
                          provider={r.provider}
                          rawAnswer={r.rawAnswer}
                          isCorrect={r.isCorrect}
                          latencyMs={r.latencyMs}
                          error={r.error}
                          expectedAnswer={currentResult.expectedAnswer}
                        />
                      ))}
                      <p className="text-center text-xs text-slate-600 pt-1">
                        {currentResult.results.filter((r) => r.isCorrect).length} /{" "}
                        {currentResult.results.length} models answered correctly
                      </p>
                    </div>
                  )}
                </Section>
              </div>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  step: "01",
                  title: "Record or upload audio",
                  desc: "Capture up to 30 minutes of audio, or upload an existing file.",
                },
                {
                  step: "02",
                  title: "Set a question + answer",
                  desc: "Write a question whose answer is unambiguous and easy to verify.",
                },
                {
                  step: "03",
                  title: "Compare models",
                  desc: "GPT-4o Audio, Gemini 2.0 Flash, and Gemini 1.5 Pro all answer simultaneously.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60"
                >
                  <div className="text-xs font-mono text-brand-500/60 mb-2">{item.step}</div>
                  <div className="font-semibold text-slate-200 text-sm mb-1">{item.title}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* LEADERBOARD TAB */}
        {tab === "leaderboard" && (
          <div className="space-y-6">
            <Section title="Model Accuracy Leaderboard">
              <p className="text-xs text-slate-500">
                Ranked by % correct across all submitted evaluations. Errors excluded from accuracy calculation.
              </p>
              <Leaderboard rows={leaderboard} isLoading={leaderboardLoading} />
            </Section>

            <Section title="Recent Submissions">
              <RecentSubmissions submissions={submissions} />
            </Section>
          </div>
        )}
      </div>
    </main>
  );
}
