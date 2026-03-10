"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Lock,
  Cpu,
  AlertTriangle,
  Download,
} from "lucide-react";
import type { MLCEngineInterface, InitProgressReport } from "@mlc-ai/web-llm";
import { getConversationSystemPrompt } from "@/lib/prompts";

const MODELS = [
  {
    id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    name: "Llama 3.2 · 1B",
    size: "~0.7 GB",
    badge: "Fastest",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 · 3B",
    size: "~2.0 GB",
    badge: "Balanced",
    badgeColor: "bg-brand-100 text-brand-700",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Phi 3.5 Mini · 3.8B",
    size: "~2.2 GB",
    badge: "Best quality",
    badgeColor: "bg-amber-100 text-amber-700",
  },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

function AssistantMessage({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const [showFeedback, setShowFeedback] = useState(true);
  const dividerIdx = content.indexOf("\n---");
  const irishPart = dividerIdx >= 0 ? content.slice(0, dividerIdx).trim() : content;
  const feedbackPart = dividerIdx >= 0 ? content.slice(dividerIdx + 4).trim() : null;

  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-white text-sm">
        <Lock size={12} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="glass-card rounded-2xl rounded-tl-sm p-4 max-w-prose">
          <p className="text-surface-900 whitespace-pre-wrap leading-relaxed">
            {irishPart}
            {streaming && !feedbackPart && (
              <span className="inline-block w-0.5 h-4 bg-surface-600 ml-0.5 animate-cursor" />
            )}
          </p>
        </div>

        {feedbackPart && (
          <div className="mt-2">
            <button
              onClick={() => setShowFeedback((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 font-medium transition-colors mb-1"
            >
              {showFeedback ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showFeedback ? "Hide" : "Show"} feedback
            </button>
            {showFeedback && (
              <div className="bg-surface-50/80 border border-surface-200 rounded-xl p-3 text-sm text-surface-700 whitespace-pre-wrap leading-relaxed">
                {feedbackPart}
                {streaming && (
                  <span className="inline-block w-0.5 h-3.5 bg-surface-500 ml-0.5 animate-cursor" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type WebGpuStatus = "checking" | "supported" | "unsupported";
type ModelStatus = "idle" | "loading" | "ready" | "error";

export default function PrivateChatInterface() {
  const [webGpuStatus, setWebGpuStatus] = useState<WebGpuStatus>("checking");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadText, setLoadText] = useState("");
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);

  const engineRef = useRef<MLCEngineInterface | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      setWebGpuStatus("supported");
    } else {
      setWebGpuStatus("unsupported");
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadModel = useCallback(async () => {
    setModelStatus("loading");
    setLoadProgress(0);
    setLoadText("Initialising…");

    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      const onProgress = (report: InitProgressReport) => {
        setLoadText(report.text);
        setLoadProgress(Math.round(report.progress * 100));
      };

      const engine = await CreateMLCEngine(selectedModel, {
        initProgressCallback: onProgress,
      });

      engineRef.current = engine;
      setModelStatus("ready");
      setLoadProgress(100);
    } catch (err) {
      console.error("WebLLM load error:", err);
      setModelStatus("error");
      setLoadText(err instanceof Error ? err.message : "Failed to load model.");
    }
  }, [selectedModel]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || generating || !engineRef.current) return;

      const userMessage: Message = { role: "user", content: text.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setGenerating(true);
      abortRef.current = false;

      const assistantIdx = messages.length + 1;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", streaming: true },
      ]);

      try {
        const history = [
          ...messages,
          userMessage,
        ].map((m) => ({ role: m.role, content: m.content }));

        const chunks = await engineRef.current.chat.completions.create({
          messages: [
            { role: "system", content: getConversationSystemPrompt() },
            ...history,
          ],
          stream: true,
          temperature: 0.7,
          max_tokens: 1500,
        });

        let accumulated = "";
        for await (const chunk of chunks) {
          if (abortRef.current) break;
          const delta = chunk.choices[0]?.delta?.content ?? "";
          accumulated += delta;
          setMessages((prev) => {
            const updated = [...prev];
            updated[assistantIdx] = {
              role: "assistant",
              content: accumulated,
              streaming: true,
            };
            return updated;
          });
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIdx] = {
            role: "assistant",
            content: accumulated,
            streaming: false,
          };
          return updated;
        });
      } catch (err) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIdx] = {
            role: "assistant",
            content: "Tá brón orm — there was an error generating a response. Please try again.",
            streaming: false,
          };
          return updated;
        });
        console.error("Generation error:", err);
      } finally {
        setGenerating(false);
        inputRef.current?.focus();
      }
    },
    [generating, messages]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const resetSession = () => {
    abortRef.current = true;
    setMessages([]);
    setGenerating(false);
  };

  // ── WebGPU not available ──────────────────────────────────────────────────
  if (webGpuStatus === "checking") {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 gap-3 text-surface-400">
        <Cpu size={36} className="animate-pulse" />
        <p className="text-sm">Checking WebGPU support…</p>
      </div>
    );
  }

  if (webGpuStatus === "unsupported") {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 px-6 gap-4 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
          <AlertTriangle size={28} className="text-amber-600" />
        </div>
        <div>
          <h2 className="font-display font-bold text-xl text-surface-900 mb-2">
            WebGPU not available
          </h2>
          <p className="text-sm text-surface-500 leading-relaxed">
            Your browser doesn&apos;t support WebGPU, which is required to run models locally.
            Try Chrome 113+ or Edge 113+ on desktop. Safari has experimental WebGPU support
            behind a flag.
          </p>
        </div>
        <p className="text-xs text-surface-400 bg-surface-100 rounded-xl px-4 py-2">
          The standard <strong>Comhrá</strong> mode uses GPT-4o via our server and works in all browsers.
        </p>
      </div>
    );
  }

  // ── Model loader ──────────────────────────────────────────────────────────
  if (modelStatus === "idle" || modelStatus === "error") {
    const selected = MODELS.find((m) => m.id === selectedModel)!;
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-6 gap-6 max-w-sm mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center">
          <Lock size={24} className="text-surface-600" />
        </div>

        <div>
          <h2 className="font-display font-bold text-xl text-surface-900 mb-1">
            Choose a model
          </h2>
          <p className="text-sm text-surface-500">
            The model runs entirely in your browser. Nothing is sent to any server.
          </p>
        </div>

        <div className="w-full space-y-2">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => setSelectedModel(model.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                selectedModel === model.id
                  ? "border-surface-400 bg-white shadow-sm"
                  : "border-surface-200 bg-white/60 hover:border-surface-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-surface-900">{model.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${model.badgeColor}`}>
                  {model.badge}
                </span>
              </div>
              <p className="text-xs text-surface-400 mt-0.5">{model.size} download on first use</p>
            </button>
          ))}
        </div>

        {modelStatus === "error" && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 w-full text-left">
            {loadText}
          </p>
        )}

        <button
          onClick={loadModel}
          className="w-full btn-primary flex items-center justify-center gap-2 py-3 rounded-xl"
        >
          <Download size={16} />
          Load {selected.name}
        </button>

        <p className="text-xs text-surface-400 flex items-center gap-1.5">
          <Lock size={10} />
          Your conversations never leave your device
        </p>
      </div>
    );
  }

  // ── Loading progress ──────────────────────────────────────────────────────
  if (modelStatus === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-6 gap-6 max-w-sm mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center">
          <Cpu size={24} className="text-surface-600 animate-pulse" />
        </div>
        <div>
          <h2 className="font-display font-bold text-xl text-surface-900 mb-1">
            Loading model…
          </h2>
          <p className="text-sm text-surface-500">
            First load downloads the model to your browser cache. Subsequent loads are instant.
          </p>
        </div>
        <div className="w-full">
          <div className="flex justify-between text-xs text-surface-500 mb-1.5">
            <span className="truncate max-w-[200px]">{loadText}</span>
            <span className="font-medium tabular-nums">{loadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-surface-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-surface-700 rounded-full transition-all duration-300"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-surface-400">
          Model is cached after the first download
        </p>
      </div>
    );
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  const isEmpty = messages.length === 0;
  const modelInfo = MODELS.find((m) => m.id === selectedModel);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200/60 bg-white/50 backdrop-blur-sm">
        <div>
          <h2 className="font-display font-bold text-surface-900">
            Comhrá Príobháideach
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-surface-400">
            <Lock size={10} className="text-surface-400" />
            <span>{modelInfo?.name ?? "Local model"} · runs in your browser</span>
          </div>
        </div>
        <button
          onClick={resetSession}
          className="btn-ghost flex items-center gap-1.5 text-sm"
          title="Start new conversation"
        >
          <RotateCcw size={14} />
          New
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-6 space-y-5">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-4">
            <div className="text-5xl">🔒</div>
            <div>
              <p className="font-display font-bold text-xl text-surface-700 mb-1">
                Conas atá tú?
              </p>
              <p className="text-sm text-surface-400 max-w-xs">
                Chat in Irish with a model running entirely on your device.{" "}
                <span className="text-surface-500">Try &quot;Dia duit!&quot; (Hello!)</span>
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex gap-3 items-start justify-end">
              <div className="glass-card rounded-2xl rounded-tr-sm p-4 max-w-prose bg-surface-100/50">
                <p className="text-surface-900 whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </p>
              </div>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center text-surface-600 text-sm font-bold">
                U
              </div>
            </div>
          ) : (
            <AssistantMessage key={i} content={msg.content} streaming={msg.streaming} />
          )
        )}

        {generating && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-white">
              <Lock size={12} />
            </div>
            <div className="glass-card rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-surface-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-surface-200/60 bg-white/50 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scríobh anseo… (Write here…)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-surface-400 focus:border-transparent transition-all max-h-32 overflow-y-auto"
            style={{ minHeight: "44px" }}
            disabled={generating}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={generating || !input.trim()}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-surface-800 hover:bg-surface-900 disabled:bg-surface-200 disabled:text-surface-400 text-white flex items-center justify-center transition-all duration-150 active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-xs text-surface-400 mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
