"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cpu, Loader2, Plane, Zap, ZapOff } from "lucide-react";

const STORAGE_KEY = "offlinellm_chat";
const DEFAULT_SYSTEM =
  "You are a helpful assistant. You are running entirely in the user's browser with no internet. Keep replies concise and friendly.";

const MODELS: { id: string; label: string; sizeMb: number }[] = [
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "Llama 3.2 3B", sizeMb: 1900 },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B", sizeMb: 800 },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC", label: "Phi 3.5 Mini", sizeMb: 2400 },
  { id: "Qwen2-0.5B-Instruct-q4f16_1-MLC", label: "Qwen2 0.5B", sizeMb: 400 },
];

type Message = { role: "user" | "assistant"; content: string; streaming?: boolean };

function getIsHappypathTest(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("happypath") === "1";
}

export default function OfflineLLMPage() {
  const [isHappypathTest] = useState(() => getIsHappypathTest());
  const [selectedModelId, setSelectedModelId] = useState<string>(MODELS[0]!.id);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadProgress, setLoadProgress] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
  const engineRef = useRef<unknown>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } };
        const adapter = await nav.gpu?.requestAdapter();
        setWebGPUSupported(!!adapter);
      } catch {
        setWebGPUSupported(false);
      }
    };
    check();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore quota / private
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadModel = useCallback(async () => {
    setStatus("loading");
    setLoadProgress(0);

    if (isHappypathTest) {
      const steps = [20, 50, 80, 100];
      for (let i = 0; i < steps.length; i++) {
        await new Promise((r) => setTimeout(r, 300));
        setLoadProgress(steps[i]!);
      }
      await new Promise((r) => setTimeout(r, 200));
      engineRef.current = {
        chat: {
          completions: {
            create: async () =>
              (async function* () {
                yield { choices: [{ delta: { content: "Hello! [happypath test reply]." } }] };
              })(),
          },
        },
      };
      setStatus("ready");
      return;
    }

    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const engine = await CreateMLCEngine(selectedModelId, {
        initProgressCallback: (p: { progress?: number } | number) => {
          const progress = typeof p === "number" ? p : p?.progress ?? 0;
          setLoadProgress(Math.round(progress * 100));
        },
      });
      engineRef.current = engine;
      setStatus("ready");
    } catch (err) {
      console.error("Model load failed:", err);
      setStatus("error");
    }
  }, [selectedModelId, isHappypathTest]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || status !== "ready") return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, assistantMsg]);

    const engine = engineRef.current as {
      chat: {
        completions: {
          create: (opts: unknown) => Promise<
            AsyncIterable<{ choices: { delta: { content?: string } }[] }>
          >;
        };
      };
    } | null;

    if (!engine) {
      setMessages((prev) =>
        prev.map((m) =>
          m === assistantMsg
            ? { ...m, content: "Model not loaded. Reload and try again.", streaming: false }
            : m
        )
      );
      return;
    }

    const history = [...messages, userMsg].map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    const chatMessages = [
      { role: "system" as const, content: DEFAULT_SYSTEM },
      ...history,
      { role: "user" as const, content: text },
    ];

    try {
      const stream = await engine.chat.completions.create({
        messages: chatMessages,
        max_tokens: 512,
        temperature: 0.7,
        stream: true,
      });
      let full = "";
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? "";
        full += token;
        setMessages((prev) =>
          prev.map((m) =>
            m === assistantMsg ? { ...m, content: full } : m
          )
        );
      }
      setMessages((prev) =>
        prev.map((m) => (m === assistantMsg ? { ...m, streaming: false } : m))
      );
    } catch (err) {
      console.error("Generate failed:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m === assistantMsg
            ? { ...m, content: "Generation failed. Try again.", streaming: false }
            : m
        )
      );
    }
  }, [input, status, messages]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a12] text-zinc-100">
      <header className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-[#1e1e32]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base tracking-tight truncate">
            OfflineLLM
          </span>
        </div>
        {status === "ready" && (
          <div
            className="flex items-center gap-1.5 text-xs text-emerald-400 shrink-0"
            data-testid="offlinellm-ready"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Ready · offline</span>
          </div>
        )}
        {status === "loading" && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full progress-shimmer rounded-full transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <span className="text-xs text-violet-400 tabular-nums w-8">
              {loadProgress}%
            </span>
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 shrink-0">
            <ZapOff className="w-3.5 h-3.5" />
            <span>Load failed</span>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        {status !== "ready" ? (
          <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center justify-center min-h-0">
            <div className="w-full max-w-md space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-600/80 flex items-center justify-center mx-auto mb-4">
                  <Plane className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-xl font-bold text-zinc-100">
                  Your LLM for the next flight
                </h1>
                <p className="text-sm text-zinc-500 mt-2">
                  Download a model once while you have Wi‑Fi. Use it entirely
                  offline in the air — no server, no API, no data leaves your
                  device.
                </p>
              </div>

              {webGPUSupported === false && (
                <div className="p-3 rounded-xl bg-rose-900/20 border border-rose-800/40 text-xs text-rose-300 flex gap-2">
                  <ZapOff className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    WebGPU is not available in this browser. Use Chrome 113+ or
                    Edge 113+ for in-browser LLM.
                  </span>
                </div>
              )}

              {webGPUSupported === true && (
                <div className="p-3 rounded-xl bg-emerald-900/20 border border-emerald-800/40 text-xs text-emerald-300 flex items-center gap-2">
                  <Zap className="w-4 h-4 shrink-0" />
                  WebGPU detected — models run fully on-device.
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Choose a model (download size)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedModelId(m.id)}
                      disabled={status === "loading"}
                      className={`text-left p-3 min-h-[44px] rounded-xl border transition-colors touch-manipulation ${
                        selectedModelId === m.id
                          ? "bg-violet-900/40 border-violet-500/50 text-zinc-100"
                          : "bg-[#111120] border-[#1e1e32] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                      }`}
                    >
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="text-xs text-zinc-500 block mt-0.5">
                        ~{m.sizeMb} MB
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={loadModel}
                disabled={status === "loading" || (webGPUSupported === false && !isHappypathTest)}
                className="w-full min-h-[48px] py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 touch-manipulation"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Downloading…
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4" />
                    Download & load model
                  </>
                )}
              </button>

              <p className="text-center text-xs text-zinc-600">
                Model is cached in your browser. After the first download you
                can use it offline.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
              data-testid="offlinellm-messages"
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-zinc-500">
                    Say something — you&apos;re running fully offline.
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    This chat is saved in your browser.
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex msg-in ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white rounded-br-sm"
                        : "bg-[#111120] border border-[#1e1e32] text-zinc-200 rounded-bl-sm"
                    } ${msg.streaming ? "streaming-cursor" : ""}`}
                  >
                    {msg.content || (msg.streaming ? "…" : "")}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 px-4 py-3 border-t border-[#1e1e32] bg-[#0a0a12] safe-area-bottom">
              <form
                className="flex gap-2 items-stretch"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message…"
                  maxLength={2000}
                  className="flex-1 min-h-[44px] bg-[#111120] border border-[#1e1e32] rounded-xl px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="px-4 min-h-[44px] rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors touch-manipulation"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
