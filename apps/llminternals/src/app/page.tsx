"use client";

import { useCallback, useMemo, useState } from "react";
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
    </div>
  );
}
