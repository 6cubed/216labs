"use client";

import { CitationMarkdown } from "@/components/CitationMarkdown";
import { fetchWikipediaContext } from "@/lib/clientRetrieval";
import {
  deleteLocalSession,
  deriveLocalTitle,
  listLocalSessions,
  loadLocalSession,
  saveLocalSession,
} from "@/lib/localSessionStore";
import type { ChatMessage, Source } from "@/lib/types";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type UiMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  related?: string[];
  streaming?: boolean;
};

type SessionMeta = { id: string; title: string; updatedAt: string };

const BROWSER_MODELS = [
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B — balanced",
  },
  {
    id: "Qwen2-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2 0.5B — smallest / fastest",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    label: "Phi 3.5 Mini",
  },
] as const;

function faviconUrl(u: string): string {
  try {
    const host = new URL(u).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
  } catch {
    return "";
  }
}

function newMsgId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function getHappypath(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("happypath") === "1";
}

export default function Home() {
  const [mode, setMode] = useState<"local" | "cloud">("local");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stopLlmRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [isHappypath] = useState(() => getHappypath());
  const [modelId, setModelId] = useState<string>(BROWSER_MODELS[0]!.id);
  const [llmStatus, setLlmStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [loadProgress, setLoadProgress] = useState(0);
  const engineRef = useRef<unknown>(null);

  const refreshSessions = useCallback(async () => {
    if (mode === "local") {
      setSessions(listLocalSessions());
      return;
    }
    try {
      const r = await fetch("/api/sessions");
      if (!r.ok) return;
      const data = (await r.json()) as { sessions: SessionMeta[] };
      setSessions(data.sessions ?? []);
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadBrowserModel = useCallback(async () => {
    setLlmStatus("loading");
    setLoadProgress(0);
    setError(null);

    if (isHappypath) {
      for (const p of [25, 60, 100]) {
        await new Promise((r) => setTimeout(r, 200));
        setLoadProgress(p);
      }
      engineRef.current = {
        chat: {
          completions: {
            create: async () =>
              (async function* () {
                yield {
                  choices: [{ delta: { content: "Happypath stub reply. [1]" } }],
                };
              })(),
          },
        },
      };
      setLlmStatus("ready");
      return;
    }

    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (p: { progress?: number } | number) => {
          const progress = typeof p === "number" ? p : p?.progress ?? 0;
          setLoadProgress(Math.round(progress * 100));
        },
      });
      engineRef.current = engine;
      setLlmStatus("ready");
    } catch (err) {
      console.error(err);
      setLlmStatus("error");
      setError(
        "Could not load the browser model. Use a WebGPU-capable browser (Chrome, Edge) or switch to Cloud mode."
      );
    }
  }, [modelId, isHappypath]);

  const hasConversation = messages.length > 0;
  const localReady = mode === "local" && (llmStatus === "ready" || isHappypath);
  const inputLocked =
    loading || (mode === "local" && !localReady && !isHappypath);

  const sendCloud = async (text: string, prior: UiMessage[]) => {
    const apiMessages = [
      ...prior.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId ?? undefined,
        messages: apiMessages,
      }),
      signal: abortRef.current?.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || res.statusText);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const dec = new TextDecoder();
    let buf = "";
    let sources: Source[] = [];
    let related: string[] = [];
    let acc = "";
    let doneSid: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let ev: Record<string, unknown>;
        try {
          ev = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (ev.type === "sources") {
          sources = (ev.sources as Source[]) ?? [];
        } else if (ev.type === "token" && typeof ev.text === "string") {
          acc += ev.text;
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy.length - 1;
            if (copy[last]?.role === "assistant") {
              copy[last] = {
                role: "assistant",
                content: acc,
                sources,
                streaming: true,
              };
            }
            return copy;
          });
        } else if (ev.type === "related") {
          related = (ev.questions as string[]) ?? [];
        } else if (ev.type === "error") {
          throw new Error(String(ev.message || "Stream error"));
        } else if (ev.type === "done") {
          doneSid = typeof ev.sessionId === "string" ? ev.sessionId : null;
          if (typeof ev.searchQuery === "string") setSearchQuery(ev.searchQuery);
        }
      }
    }

    setSessionId(doneSid);
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy.length - 1;
      if (copy[last]?.role === "assistant") {
        copy[last] = {
          role: "assistant",
          content: acc,
          sources,
          related,
          streaming: false,
        };
      }
      return copy;
    });
    void refreshSessions();
  };

  const sendLocal = async (text: string, prior: UiMessage[]) => {
    const engine = engineRef.current as {
      chat: {
        completions: {
          create: (opts: unknown) => Promise<
            AsyncIterable<{ choices: { delta: { content?: string } }[] }>
          >;
        };
      };
    } | null;
    if (!engine) throw new Error("Load the browser model first.");

    stopLlmRef.current = false;
    setSearchQuery(null);

    let sources: Source[];
    let contextBlock: string;
    let searchLabel: string;

    if (isHappypath) {
      sources = [];
      contextBlock =
        "Automated test mode — no live Wikipedia fetch. Answer briefly.";
      searchLabel = "happypath";
    } else {
      const w = await fetchWikipediaContext(text, abortRef.current?.signal);
      sources = w.sources;
      contextBlock = w.contextBlock;
      searchLabel = w.searchLabel;
    }
    setSearchQuery(`Wikipedia · ${searchLabel}`);

    const system = `You are a concise research assistant. Answer using the Wikipedia excerpts below. Cite facts inline with [1], [2], etc. matching the numbered sources. If excerpts are insufficient, say so. Use Markdown. Keep the answer focused.

${contextBlock}`;

    const historyOpenAI = [
      { role: "system" as const, content: system },
      ...prior.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: text },
    ];

    const stream = await engine.chat.completions.create({
      messages: historyOpenAI,
      max_tokens: 2048,
      temperature: 0.4,
      stream: true,
    });

    let acc = "";
    for await (const chunk of stream) {
      if (stopLlmRef.current) break;
      const token = chunk.choices[0]?.delta?.content ?? "";
      if (token) {
        acc += token;
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy.length - 1;
          if (copy[last]?.role === "assistant") {
            copy[last] = {
              role: "assistant",
              content: acc,
              sources,
              streaming: true,
            };
          }
          return copy;
        });
      }
    }

    const related = sources
      .slice(0, 3)
      .map((s) => `More: ${s.title}`);

    setMessages((prev) => {
      const copy = [...prev];
      const last = copy.length - 1;
      if (copy[last]?.role === "assistant") {
        copy[last] = {
          role: "assistant",
          content: acc,
          sources,
          related,
          streaming: false,
        };
      }
      return copy;
    });

    const now = new Date().toISOString();
    const sid = sessionId ?? crypto.randomUUID();
    const priorSession = sessionId ? loadLocalSession(sessionId) : null;

    const userMsg: ChatMessage = {
      id: newMsgId(),
      role: "user",
      content: text,
      createdAt: now,
    };
    const asstMsg: ChatMessage = {
      id: newMsgId(),
      role: "assistant",
      content: acc,
      sources,
      related,
      createdAt: now,
    };

    let baseMsgs: ChatMessage[] = priorSession?.messages ?? [];
    while (
      baseMsgs.length > 0 &&
      baseMsgs[baseMsgs.length - 1]!.role === "user" &&
      baseMsgs[baseMsgs.length - 1]!.content === text
    ) {
      baseMsgs = baseMsgs.slice(0, -1);
    }

    const title =
      priorSession && priorSession.messages.length > 0
        ? priorSession.title
        : deriveLocalTitle(text);

    saveLocalSession({
      id: sid,
      title,
      messages: [...baseMsgs, userMsg, asstMsg],
      updatedAt: now,
    });
    setSessionId(sid);
    void refreshSessions();
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading || inputLocked) return;

    setError(null);
    setLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const prior = [...messages];
    const nextMessages: UiMessage[] = [
      ...prior,
      { role: "user", content: q },
      { role: "assistant", content: "", streaming: true },
    ];
    setMessages(nextMessages);
    setInput("");

    try {
      if (mode === "cloud") {
        await sendCloud(q, prior);
      } else {
        await sendLocal(q, prior);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMessages((prev) => (prev.length >= 2 ? prev.slice(0, -2) : []));
        return;
      }
      const msg = e instanceof Error ? e.message : "Request failed";
      setError(msg);
      setMessages((prev) => (prev.length >= 2 ? prev.slice(0, -2) : []));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    stopLlmRef.current = true;
    abortRef.current?.abort();
  };

  const newChat = () => {
    setSessionId(null);
    setMessages([]);
    setInput("");
    setError(null);
    setSearchQuery(null);
  };

  const switchMode = (m: "local" | "cloud") => {
    if (m === mode) return;
    setMode(m);
    newChat();
    setTimeout(() => void refreshSessions(), 0);
  };

  const loadSession = async (id: string) => {
    setError(null);
    if (mode === "local") {
      const s = loadLocalSession(id);
      if (!s) return;
      setSessionId(id);
      setMessages(
        s.messages.map((m) => ({
          role: m.role,
          content: m.content,
          sources: m.sources,
          related: m.related,
        }))
      );
      return;
    }
    const r = await fetch(`/api/sessions/${id}`);
    if (!r.ok) return;
    const data = (await r.json()) as { session: { messages: ChatMessage[] } };
    const msgs = data.session.messages;
    setSessionId(id);
    setMessages(
      msgs.map((m) => ({
        role: m.role,
        content: m.content,
        sources: m.sources,
        related: m.related,
      }))
    );
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode === "local") {
      deleteLocalSession(id);
    } else {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    }
    if (sessionId === id) newChat();
    void refreshSessions();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const suggested = useMemo(
    () => [
      "What is quantum entanglement?",
      "Summarize the history of the printing press",
      "Who invented the World Wide Web?",
    ],
    []
  );

  return (
    <div className="relative min-h-screen bg-[var(--bg)] bg-grid">
      <div
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-sky-500/5 via-transparent to-indigo-500/5"
        aria-hidden
      />

      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-72 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform max-md:shadow-xl md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-2 border-b border-[var(--border)] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold tracking-tight text-[var(--text)]">
              LLM Search
            </span>
            <button
              type="button"
              onClick={newChat}
              className="rounded-lg bg-[var(--surface2)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--border)]"
            >
              New chat
            </button>
          </div>
          <div className="flex rounded-lg border border-[var(--border)] p-0.5 text-xs">
            <button
              type="button"
              className={`flex-1 rounded-md px-2 py-1.5 font-medium ${
                mode === "local"
                  ? "bg-[var(--surface2)] text-[var(--text)]"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
              onClick={() => switchMode("local")}
            >
              Browser
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-2 py-1.5 font-medium ${
                mode === "cloud"
                  ? "bg-[var(--surface2)] text-[var(--text)]"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
              onClick={() => switchMode("cloud")}
            >
              Cloud
            </button>
          </div>
        </div>

        {mode === "local" && (
          <div className="border-b border-[var(--border)] p-3 text-xs">
            <label className="mb-1 block text-[var(--muted)]">Model (runs in your browser)</label>
            <select
              className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[var(--text)]"
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value);
                setLlmStatus("idle");
                engineRef.current = null;
              }}
              disabled={llmStatus === "loading"}
            >
              {BROWSER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {llmStatus !== "ready" && !isHappypath && (
              <button
                type="button"
                onClick={() => void loadBrowserModel()}
                disabled={llmStatus === "loading"}
                className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 px-3 py-2 font-medium text-white disabled:opacity-50"
              >
                {llmStatus === "loading"
                  ? `Loading… ${loadProgress}%`
                  : llmStatus === "error"
                    ? "Retry load"
                    : "Load model (WebGPU)"}
              </button>
            )}
            {llmStatus === "ready" && (
              <p className="mt-2 text-emerald-400/90">Model ready · private · no API keys</p>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => void loadSession(s.id)}
              className={`group mb-1 flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-[var(--surface2)] ${
                sessionId === s.id ? "bg-[var(--surface2)]" : ""
              }`}
            >
              <span className="line-clamp-2 flex-1 text-[var(--text)]">{s.title}</span>
              <button
                type="button"
                className="shrink-0 text-[var(--muted)] opacity-0 hover:text-red-400 group-hover:opacity-100"
                onClick={(e) => void deleteSession(s.id, e)}
                aria-label="Delete chat"
              >
                ×
              </button>
            </button>
          ))}
        </div>
        <p className="border-t border-[var(--border)] p-3 text-[10px] leading-relaxed text-[var(--muted)]">
          {mode === "local"
            ? "Browser mode: Wikipedia excerpts + WebLLM. No server keys. Chats stay in this browser."
            : "Cloud mode: Tavily/Brave + OpenAI on the server. Set keys in admin Env."}
        </p>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main
        className={`relative z-10 mx-auto min-h-screen max-w-3xl px-3 pb-32 pt-4 transition-[margin] md:ml-72 md:px-6 ${
          hasConversation ? "" : "flex flex-col justify-center"
        }`}
      >
        <header className="mb-6 flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)] md:hidden"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text)] md:text-2xl">
              Ask anything
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {mode === "local"
                ? "Wikipedia-backed · Client LLM · Citations · Local history"
                : "Live web sources · Citations · Streaming · Server history"}
            </p>
          </div>
        </header>

        {!hasConversation && (
          <div className="mb-8 flex flex-wrap gap-2">
            {suggested.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                disabled={inputLocked}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-left text-sm text-[var(--muted)] transition hover:border-sky-500/40 hover:text-[var(--text)] disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div
            className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="space-y-8">
          {messages.map((m, idx) => (
            <article key={idx}>
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[92%] rounded-2xl bg-[var(--surface2)] px-4 py-3 text-[var(--text)]">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {m.streaming && !m.content && (
                    <div className="flex gap-1.5 text-[var(--muted)]">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400 [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400 [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" />
                    </div>
                  )}
                  {m.content ? (
                    <CitationMarkdown content={m.content} sources={m.sources ?? []} />
                  ) : null}

                  {m.sources && m.sources.length > 0 && !m.streaming && (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                        Sources
                      </div>
                      <ul className="space-y-2">
                        {m.sources.map((s, i) => (
                          <li key={s.url + i}>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex gap-2 rounded-lg p-2 hover:bg-[var(--surface2)]"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={faviconUrl(s.url)}
                                alt=""
                                className="mt-0.5 h-4 w-4 shrink-0 opacity-80"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-[var(--text)]">
                                  <span className="mr-2 text-[var(--accent)]">[{i + 1}]</span>
                                  {s.title}
                                </div>
                                <div className="truncate text-xs text-[var(--muted)]">{s.url}</div>
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {m.related && m.related.length > 0 && !m.streaming && (
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                        Related
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {m.related.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => void send(q)}
                            disabled={inputLocked}
                            className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-left text-sm text-[var(--muted)] hover:border-sky-500/40 hover:text-[var(--text)] disabled:opacity-40"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>

        {searchQuery && hasConversation && (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Retrieval: <span className="text-[var(--accent)]">{searchQuery}</span>
          </p>
        )}

        <div ref={bottomRef} />
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--border)] bg-[var(--bg)]/90 p-3 backdrop-blur md:left-72">
        <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl gap-2">
          <input
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
            placeholder={
              mode === "local"
                ? localReady
                  ? "Ask a question…"
                  : "Load the model in the sidebar first…"
                : "Ask a question…"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={inputLocked}
          />
          {loading ? (
            <button
              type="button"
              onClick={stop}
              className="shrink-0 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-sm font-medium text-red-200 hover:bg-red-500/20"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || inputLocked}
              className="shrink-0 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 disabled:opacity-40"
            >
              Search
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
