"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  createWeights,
  forward,
  tokenize,
  type ForwardResult,
  type TransformerConfig,
  DEFAULT_CONFIG,
} from "@/lib/transformer";

type Mode = "lm" | "classifier";
type ClassDef = { name: string; tokenChars: string };
type ModelPreset = {
  id: string;
  name: string;
  description: string;
  config: TransformerConfig;
  seed: number;
};
type CompareResult = {
  modelId: string;
  modelName: string;
  lmTop?: { idx: number; char: string; logit: number };
  classes?: Array<{ name: string; prob: number }>;
};
type BrowserModelPreset = { id: string; name: string; note: string };

const BROWSER_MODELS: BrowserModelPreset[] = [
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 1B Instruct",
    note: "Best default for phone/laptop WebGPU",
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 0.5B Instruct",
    note: "Smaller, usually faster",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Phi 3.5 Mini Instruct",
    note: "Alternative reasoning style",
  },
];

const MODEL_PRESETS: ModelPreset[] = [
  {
    id: "tiny-base",
    name: "Tiny Base",
    description: "64 hidden · 2 layers",
    config: DEFAULT_CONFIG,
    seed: 42,
  },
  {
    id: "tiny-deep",
    name: "Tiny Deep",
    description: "64 hidden · 4 layers",
    config: {
      ...DEFAULT_CONFIG,
      numLayers: 4,
      maxLen: 192,
    },
    seed: 7,
  },
  {
    id: "tiny-wide",
    name: "Tiny Wide",
    description: "96 hidden · 3 layers",
    config: {
      ...DEFAULT_CONFIG,
      hiddenSize: 96,
      numHeads: 6,
      numLayers: 3,
      ffnSize: 384,
      maxLen: 192,
    },
    seed: 21,
  },
  {
    id: "tiny-compact",
    name: "Tiny Compact",
    description: "48 hidden · 2 layers",
    config: {
      ...DEFAULT_CONFIG,
      hiddenSize: 48,
      numHeads: 3,
      ffnSize: 192,
      numLayers: 2,
      maxLen: 128,
    },
    seed: 84,
  },
];

export default function LLMInternalsPage() {
  const [input, setInput] = useState("hello");
  const [mode, setMode] = useState<Mode>("lm");
  const [selectedModelId, setSelectedModelId] = useState(MODEL_PRESETS[0]!.id);
  const [classDefs, setClassDefs] = useState<ClassDef[]>([
    { name: "Positive", tokenChars: "Pp+" },
    { name: "Negative", tokenChars: "Nn-" },
  ]);
  const [result, setResult] = useState<ForwardResult | null>(null);
  const [comparison, setComparison] = useState<CompareResult[] | null>(null);
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [browserModelId, setBrowserModelId] = useState(BROWSER_MODELS[0]!.id);
  const [browserStatus, setBrowserStatus] =
    useState<"idle" | "loading" | "ready" | "running" | "error">("idle");
  const [browserLoadProgress, setBrowserLoadProgress] = useState(0);
  const [browserResult, setBrowserResult] = useState<{
    yProb: number;
    nProb: number;
    answer: "Y" | "N";
    reason: string;
    raw: string;
  } | null>(null);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const browserEngineRef = useRef<any>(null);

  const activePreset = useMemo(
    () => MODEL_PRESETS.find((p) => p.id === selectedModelId) ?? MODEL_PRESETS[0]!,
    [selectedModelId]
  );
  const weights = useMemo(
    () => createWeights(activePreset.config, 0, activePreset.seed),
    [activePreset]
  );

  const runForward = useCallback(() => {
    const ids = tokenize(input);
    if (ids.length === 0) return;
    const out = forward(weights, ids, true);
    setResult(out);
    setComparison(null);
    setSelectedLayer(0);
  }, [input, weights]);

  const runCompareModels = useCallback(() => {
    const ids = tokenize(input);
    if (ids.length === 0) return;
    const rows: CompareResult[] = MODEL_PRESETS.map((preset) => {
      const w = createWeights(preset.config, 0, preset.seed);
      const out = forward(w, ids, false);
      if (mode === "lm") {
        const [top] = topKIndices(out.logits, 1);
        return {
          modelId: preset.id,
          modelName: preset.name,
          lmTop: top
            ? { idx: top[0], char: String.fromCharCode(top[0]), logit: top[1] }
            : undefined,
        };
      }
      const classes = computeClassProbabilities(out.logits, classDefs).map((c) => ({
        name: c.name,
        prob: c.prob,
      }));
      return {
        modelId: preset.id,
        modelName: preset.name,
        classes,
      };
    });
    setComparison(rows);
  }, [classDefs, input, mode]);

  const activations = result?.activations ?? [];
  const selectedActivation = activations[selectedLayer];
  const ynFromToyLogits = result ? computeYNFromLogits(result.logits) : null;

  const loadBrowserModel = useCallback(async () => {
    setBrowserStatus("loading");
    setBrowserLoadProgress(0);
    setBrowserError(null);
    setBrowserResult(null);
    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const engine = await CreateMLCEngine(browserModelId, {
        initProgressCallback: (p: { progress: number }) =>
          setBrowserLoadProgress(Math.round((p.progress ?? 0) * 100)),
      });
      browserEngineRef.current = engine;
      setBrowserStatus("ready");
    } catch (err) {
      console.error(err);
      setBrowserStatus("error");
      setBrowserError(err instanceof Error ? err.message : "Failed to load browser model");
    }
  }, [browserModelId]);

  const runBrowserYN = useCallback(async () => {
    if (!browserEngineRef.current) return;
    setBrowserStatus("running");
    setBrowserError(null);
    setBrowserResult(null);
    try {
      const prompt = [
        "You are a strict binary classifier.",
        "Classify the user text as Y or N based on the statement being true.",
        "Return STRICT JSON only, no prose.",
        'Schema: {"Y": number, "N": number, "answer":"Y"|"N", "reason":"short phrase"}',
        "Y and N must be probabilities between 0 and 1 that sum to 1.",
        `Text: """${input}"""`,
      ].join("\n");

      const stream = await browserEngineRef.current.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 140,
        temperature: 0,
      });

      let raw = "";
      for await (const chunk of stream) {
        raw +=
          chunk.choices?.[0]?.delta?.content ??
          chunk.choices?.[0]?.message?.content ??
          "";
      }

      const parsed = parseBrowserJson(raw);
      if (!parsed) {
        throw new Error("Model did not return valid JSON. Try run again.");
      }
      setBrowserResult({
        yProb: parsed.Y,
        nProb: parsed.N,
        answer: parsed.answer,
        reason: parsed.reason || "No reason provided",
        raw,
      });
      setBrowserStatus("ready");
    } catch (err) {
      console.error(err);
      setBrowserStatus("error");
      setBrowserError(err instanceof Error ? err.message : "Browser inference failed");
    }
  }, [input]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0c0c0f] text-zinc-200">
      <header className="shrink-0 border-b border-[#252532] px-4 py-3">
        <h1 className="text-lg font-semibold text-white">LLM Internals</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Tiny transformer in the browser — inspect activations, swap head for classification
        </p>
      </header>

      <main className="flex-1 flex flex-col md:flex-row min-h-0 gap-4 p-4">
        {/* Left: controls and output */}
        <div className="flex flex-col gap-4 w-full md:max-w-md shrink-0">
          <div className="rounded-xl bg-[#14141a] border border-[#252532] p-4 space-y-3">
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Input (char-level)
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type something…"
              className="w-full rounded-lg bg-[#0c0c0f] border border-[#252532] px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
            />
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-zinc-500">Mode:</span>
              <button
                type="button"
                onClick={() => setMode("lm")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  mode === "lm"
                    ? "bg-violet-600 text-white"
                    : "bg-[#252532] text-zinc-400 hover:text-zinc-200"
                }`}
              >
                LM (next-token)
              </button>
              <button
                type="button"
                onClick={() => setMode("classifier")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  mode === "classifier"
                    ? "bg-violet-600 text-white"
                    : "bg-[#252532] text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Classifier
              </button>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
                In-browser model preset
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => {
                  setSelectedModelId(e.target.value);
                  setResult(null);
                  setComparison(null);
                  setSelectedLayer(0);
                }}
                className="w-full rounded-lg bg-[#0c0c0f] border border-[#252532] px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              >
                {MODEL_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} · {preset.description}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500">
                Active: <span className="text-zinc-300">{activePreset.name}</span> ({activePreset.description})
              </p>
            </div>
            <div className="space-y-2 rounded-lg border border-[#252532] bg-[#0f0f14] p-3">
              <p className="text-xs text-zinc-400">
                Real in-browser LLM (WebGPU) for stronger priors
              </p>
              <select
                value={browserModelId}
                onChange={(e) => {
                  setBrowserModelId(e.target.value);
                  setBrowserStatus("idle");
                  setBrowserResult(null);
                  setBrowserError(null);
                  browserEngineRef.current = null;
                }}
                className="w-full rounded bg-[#0c0c0f] border border-[#252532] px-2 py-1.5 text-xs"
              >
                {BROWSER_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-500">
                {BROWSER_MODELS.find((m) => m.id === browserModelId)?.note ?? ""}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadBrowserModel}
                  className="flex-1 rounded border border-[#3a3a49] px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#252532]"
                >
                  {browserStatus === "loading" ? `Loading… ${browserLoadProgress}%` : "Load browser model"}
                </button>
                <button
                  type="button"
                  disabled={browserStatus !== "ready" || !input.trim()}
                  onClick={runBrowserYN}
                  className="flex-1 rounded bg-emerald-700 px-2.5 py-1.5 text-xs text-white disabled:opacity-40"
                >
                  {browserStatus === "running" ? "Classifying…" : "Run Y/N classifier"}
                </button>
              </div>
              {browserError && <p className="text-xs text-rose-400">{browserError}</p>}
              {browserResult && (
                <div className="space-y-1 rounded border border-[#2a3345] bg-[#10131a] p-2">
                  <p className="text-xs text-zinc-300">
                    Answer: <span className="text-emerald-400 font-medium">{browserResult.answer}</span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    Y {(browserResult.yProb * 100).toFixed(1)}% · N {(browserResult.nProb * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-zinc-500">{browserResult.reason}</p>
                </div>
              )}
            </div>
            {mode === "classifier" && (
              <div className="space-y-2 rounded-lg border border-[#252532] bg-[#0f0f14] p-3">
                <p className="text-xs text-zinc-500">
                  Define classes by token chars. We compute relative probabilities from next-token logits.
                  Example: class A = <code>Pp+</code>, class B = <code>Nn-</code>.
                </p>
                {classDefs.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) =>
                        setClassDefs((prev) =>
                          prev.map((it, idx) => (idx === i ? { ...it, name: e.target.value } : it))
                        )
                      }
                      placeholder={`Class ${i + 1}`}
                      className="rounded bg-[#0c0c0f] border border-[#252532] px-2 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={c.tokenChars}
                      onChange={(e) =>
                        setClassDefs((prev) =>
                          prev.map((it, idx) => (idx === i ? { ...it, tokenChars: e.target.value } : it))
                        )
                      }
                      placeholder="e.g. Pp+"
                      className="rounded bg-[#0c0c0f] border border-[#252532] px-2 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      disabled={classDefs.length <= 2}
                      onClick={() =>
                        setClassDefs((prev) => prev.filter((_it, idx) => idx !== i))
                      }
                      className="rounded border border-[#3a3a49] px-2 py-1 text-xs text-zinc-300 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setClassDefs((prev) => [...prev, { name: `Class ${prev.length + 1}`, tokenChars: "" }])
                  }
                  className="rounded border border-[#3a3a49] px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#252532]"
                >
                  Add class
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={runForward}
              className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-colors"
            >
              Run forward pass
            </button>
            <button
              type="button"
              onClick={runCompareModels}
              className="w-full py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm font-medium text-white transition-colors"
            >
              Compare all model presets
            </button>
          </div>

          {result && (
            <div className="rounded-xl bg-[#14141a] border border-[#252532] p-4 space-y-3">
              <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Output (last token)
              </h2>
              {mode === "lm" ? (
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500">Top 10 logits (vocab indices):</p>
                  <div className="flex flex-wrap gap-2">
                    {topKIndices(result.logits, 10).map(([idx, val]) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded bg-[#252532] px-2 py-0.5 text-xs"
                      >
                        <span className="text-zinc-500">
                          {idx} ({String.fromCharCode(idx)}):
                        </span>
                        <span className="text-violet-400">{val.toFixed(3)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500">Relative class probabilities (from next-token logits):</p>
                  <div className="flex flex-wrap gap-2">
                    {computeClassProbabilities(result.logits, classDefs).map((c) => (
                      <span
                        key={c.name}
                        className="inline-flex items-center gap-1 rounded bg-[#252532] px-2 py-0.5 text-xs"
                      >
                        <span className="text-zinc-500">
                          {c.name} ({c.tokenPreview}):
                        </span>
                        <span className="text-emerald-400">{(c.prob * 100).toFixed(1)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ynFromToyLogits && (
                <div className="space-y-1 pt-2 border-t border-[#252532]">
                  <p className="text-xs text-zinc-500">
                    Tiny-model Y/N probability slice (explicitly tracked):
                  </p>
                  <div className="flex gap-2 text-xs">
                    <span className="rounded bg-[#252532] px-2 py-1 text-zinc-300">
                      Y: <span className="text-emerald-400">{(ynFromToyLogits.y * 100).toFixed(1)}%</span>
                    </span>
                    <span className="rounded bg-[#252532] px-2 py-1 text-zinc-300">
                      N: <span className="text-emerald-400">{(ynFromToyLogits.n * 100).toFixed(1)}%</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {comparison && (
            <div className="rounded-xl bg-[#14141a] border border-[#252532] p-4 space-y-3">
              <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Cross-model prior comparison
              </h2>
              {mode === "lm" ? (
                <div className="space-y-2">
                  {comparison.map((row) => (
                    <div
                      key={row.modelId}
                      className="rounded-md border border-[#252532] bg-[#0f0f14] px-3 py-2 text-xs"
                    >
                      <span className="text-zinc-300 font-medium">{row.modelName}</span>{" "}
                      <span className="text-zinc-500">top token:</span>{" "}
                      <span className="text-violet-400">
                        {row.lmTop ? `${row.lmTop.idx} (${row.lmTop.char}) @ ${row.lmTop.logit.toFixed(3)}` : "n/a"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {comparison.map((row) => (
                    <div
                      key={row.modelId}
                      className="rounded-md border border-[#252532] bg-[#0f0f14] px-3 py-2 text-xs"
                    >
                      <p className="text-zinc-300 font-medium mb-1">{row.modelName}</p>
                      <div className="flex flex-wrap gap-2">
                        {(row.classes ?? []).map((c) => (
                          <span key={`${row.modelId}-${c.name}`} className="rounded bg-[#252532] px-2 py-0.5">
                            <span className="text-zinc-500">{c.name}:</span>{" "}
                            <span className="text-emerald-400">{(c.prob * 100).toFixed(1)}%</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: activation visualization */}
        <div className="flex-1 min-h-0 flex flex-col rounded-xl bg-[#14141a] border border-[#252532] overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-[#252532]">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Layer activations (last token)
            </span>
            {activations.length > 0 && (
              <div className="flex gap-1">
                {activations.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedLayer(i)}
                    className={`w-8 h-7 rounded text-xs font-medium transition-colors ${
                      selectedLayer === i
                        ? "bg-violet-600 text-white"
                        : "bg-[#252532] text-zinc-400 hover:text-zinc-200"
                    }`}
                    title={i === 0 ? "Embedding" : `Layer ${i}`}
                  >
                    {i === 0 ? "E" : i}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {selectedActivation ? (
              <ActivationHeatmap activation={selectedActivation} />
            ) : result ? (
              <p className="text-sm text-zinc-500">Select a layer above.</p>
            ) : (
              <p className="text-sm text-zinc-500">
                Enter text and run forward pass to see activations.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function topKIndices(arr: Float32Array, k: number): [number, number][] {
  const indexed = Array.from(arr)
    .map((v, i) => [i, Number.isFinite(v) ? v : Number.NEGATIVE_INFINITY] as [number, number]);
  indexed.sort((a, b) => b[1] - a[1]);
  return indexed.slice(0, k);
}

function parseClassTokenIds(tokenChars: string): number[] {
  const ids = new Set<number>();
  for (const ch of tokenChars) {
    if (ch === "," || ch === " " || ch === "\t" || ch === "\n") continue;
    const id = ch.charCodeAt(0);
    ids.add(id >= 256 ? 32 : id);
  }
  return Array.from(ids);
}

function logSumExp(values: number[]): number {
  if (values.length === 0) return Number.NEGATIVE_INFINITY;
  let max = values[0]!;
  for (let i = 1; i < values.length; i++) {
    if (values[i]! > max) max = values[i]!;
  }
  if (!Number.isFinite(max)) return Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (const v of values) sum += Math.exp(v - max);
  return max + Math.log(sum);
}

function computeClassProbabilities(
  logits: Float32Array,
  defs: ClassDef[]
): Array<{ name: string; prob: number; tokenPreview: string }> {
  const prepared = defs.map((d, i) => {
    const ids = parseClassTokenIds(d.tokenChars);
    const tokenPreview = d.tokenChars.trim() || "no tokens";
    const name = d.name.trim() || `Class ${i + 1}`;
    const classScore = logSumExp(ids.map((id) => logits[id] ?? Number.NEGATIVE_INFINITY));
    return { name, tokenPreview, score: classScore };
  });

  const finiteScores = prepared.map((x) => x.score).filter(Number.isFinite);
  if (finiteScores.length === 0) {
    return prepared.map((p) => ({ name: p.name, tokenPreview: p.tokenPreview, prob: 0 }));
  }

  const max = Math.max(...finiteScores);
  let denom = 0;
  const exps = prepared.map((p) => {
    const e = Number.isFinite(p.score) ? Math.exp(p.score - max) : 0;
    denom += e;
    return e;
  });

  return prepared.map((p, i) => ({
    name: p.name,
    tokenPreview: p.tokenPreview,
    prob: denom > 0 ? exps[i]! / denom : 0,
  }));
}

function computeYNFromLogits(logits: Float32Array): { y: number; n: number } {
  const idsY = ["Y", "y"].map((c) => c.charCodeAt(0));
  const idsN = ["N", "n"].map((c) => c.charCodeAt(0));
  const yScore = logSumExp(idsY.map((id) => logits[id] ?? Number.NEGATIVE_INFINITY));
  const nScore = logSumExp(idsN.map((id) => logits[id] ?? Number.NEGATIVE_INFINITY));
  const max = Math.max(yScore, nScore);
  const yExp = Math.exp(yScore - max);
  const nExp = Math.exp(nScore - max);
  const denom = yExp + nExp;
  return {
    y: denom > 0 ? yExp / denom : 0.5,
    n: denom > 0 ? nExp / denom : 0.5,
  };
}

function parseBrowserJson(
  raw: string
): { Y: number; N: number; answer: "Y" | "N"; reason: string } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const y = Number(parsed?.Y);
    const n = Number(parsed?.N);
    const answer = parsed?.answer === "N" ? "N" : "Y";
    const reason =
      typeof parsed?.reason === "string" ? parsed.reason.slice(0, 120) : "";
    if (!Number.isFinite(y) || !Number.isFinite(n)) return null;
    const yClamped = Math.max(0, Math.min(1, y));
    const nClamped = Math.max(0, Math.min(1, n));
    const sum = yClamped + nClamped;
    if (sum <= 0) return null;
    return {
      Y: yClamped / sum,
      N: nClamped / sum,
      answer,
      reason,
    };
  } catch {
    return null;
  }
}

function ActivationHeatmap({ activation }: { activation: Float32Array }) {
  const size = activation.length;
  const gridCols = Math.ceil(Math.sqrt(size));
  let min = activation[0] ?? 0;
  let max = activation[0] ?? 0;
  for (let i = 1; i < size; i++) {
    const v = activation[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const indexed = Array.from(activation).map((v, i) => ({ i, v }));
  indexed.sort((a, b) => a.v - b.v);
  const topNeg = indexed.slice(0, 5);
  const topPos = indexed.slice(-5).reverse();

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">
        {size} dimensions · range [{min.toFixed(3)}, {max.toFixed(3)}]
      </p>
      <div
        className="grid gap-0.5 w-full max-w-2xl"
        style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
      >
        {Array.from(activation).map((v, i) => {
          const t = (v - min) / range;
          const hue = 260;
          const sat = 60;
          const light = 20 + t * 50;
          return (
            <div
              key={i}
              className="aspect-square rounded-sm border border-[#252532]/50"
              style={{
                backgroundColor: `hsl(${hue}, ${sat}%, ${light}%)`,
              }}
              title={`dim ${i}: ${v.toFixed(4)}`}
            />
          );
        })}
      </div>
      <div className="grid sm:grid-cols-2 gap-2 pt-2">
        <div className="rounded border border-[#252532] bg-[#0f0f14] p-2">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Top positive neurons</p>
          <div className="flex flex-wrap gap-1">
            {topPos.map((x) => (
              <span key={`pos-${x.i}`} className="rounded bg-emerald-900/40 border border-emerald-800/60 px-1.5 py-0.5 text-[11px] text-emerald-300">
                {x.i}: {x.v.toFixed(3)}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded border border-[#252532] bg-[#0f0f14] p-2">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Top negative neurons</p>
          <div className="flex flex-wrap gap-1">
            {topNeg.map((x) => (
              <span key={`neg-${x.i}`} className="rounded bg-rose-900/35 border border-rose-800/60 px-1.5 py-0.5 text-[11px] text-rose-300">
                {x.i}: {x.v.toFixed(3)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
