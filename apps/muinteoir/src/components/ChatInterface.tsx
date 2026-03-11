"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface ChatInterfaceProps {
  mode: "conversation" | "lesson";
  topicId?: string;
  topicTitle?: string;
  initialMessage?: string;
}

function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  const [showFeedback, setShowFeedback] = useState(true);

  // Split Irish response from feedback block
  const dividerIdx = content.indexOf("\n---");
  const irishPart = dividerIdx >= 0 ? content.slice(0, dividerIdx).trim() : content;
  const feedbackPart = dividerIdx >= 0 ? content.slice(dividerIdx + 4).trim() : null;

  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold">
        M
      </div>
      <div className="flex-1 min-w-0">
        <div className="glass-card rounded-2xl rounded-tl-sm p-4 max-w-prose">
          <p className="text-surface-900 whitespace-pre-wrap leading-relaxed">
            {irishPart}
            {streaming && !feedbackPart && (
              <span className="inline-block w-0.5 h-4 bg-brand-500 ml-0.5 animate-cursor" />
            )}
          </p>
        </div>

        {feedbackPart && (
          <div className="mt-2">
            <button
              onClick={() => setShowFeedback((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors mb-1"
            >
              {showFeedback ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showFeedback ? "Hide" : "Show"} feedback
            </button>
            {showFeedback && (
              <div className="bg-brand-50/80 border border-brand-100 rounded-xl p-3 text-sm text-surface-700 whitespace-pre-wrap leading-relaxed">
                {feedbackPart}
                {streaming && (
                  <span className="inline-block w-0.5 h-3.5 bg-brand-500 ml-0.5 animate-cursor" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatInterface({
  mode,
  topicId,
  topicTitle,
  initialMessage,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasTriggeredInitial = useRef(false);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMessage: Message = { role: "user", content: text.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);

      const assistantIdx = messages.length + 1;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", streaming: true },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            mode,
            topicId,
            sessionId,
          }),
        });

        if (!res.ok) throw new Error("Request failed");

        const newSessionId = res.headers.get("X-Session-Id");
        if (newSessionId && !sessionId) setSessionId(newSessionId);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
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
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIdx] = {
            role: "assistant",
            content: "Tá brón orm — there was an error. Please try again.",
            streaming: false,
          };
          return updated;
        });
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [loading, messages.length, mode, topicId, sessionId]
  );

  // Trigger the opening message once on mount
  useEffect(() => {
    if (initialMessage && !hasTriggeredInitial.current) {
      hasTriggeredInitial.current = true;
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const resetSession = () => {
    setMessages([]);
    setSessionId(null);
    hasTriggeredInitial.current = false;
    if (initialMessage) {
      setTimeout(() => {
        hasTriggeredInitial.current = false;
        sendMessage(initialMessage);
      }, 100);
    }
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200/60 bg-white/50 backdrop-blur-sm">
        <div>
          <h2 className="font-display font-bold text-surface-900">
            {topicTitle ?? (mode === "lesson" ? "Ceacht" : "Comhrá")}
          </h2>
          <p className="text-xs text-surface-400">
            {mode === "lesson" ? "Structured lesson" : "Free conversation"} · GPT-4o
          </p>
        </div>
        <button
          onClick={resetSession}
          className="btn-ghost flex items-center gap-1.5 text-sm"
          title="Start new session"
        >
          <RotateCcw size={14} />
          New
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-6 space-y-5">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-4">
            <div className="text-5xl">☘️</div>
            <div>
              <p className="font-display font-bold text-xl text-surface-700 mb-1">
                {mode === "lesson"
                  ? "Ready to start your lesson?"
                  : "Conas atá tú?"}
              </p>
              <p className="text-sm text-surface-400">
                {mode === "lesson"
                  ? "Type anything to begin the lesson."
                  : 'Type a message in Irish or English to start. Try "Dia duit!" (Hello!)'}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex gap-3 items-start justify-end">
              <div className="glass-card rounded-2xl rounded-tr-sm p-4 max-w-prose bg-brand-600/5">
                <p className="text-surface-900 whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </p>
              </div>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center text-surface-600 text-sm font-bold">
                U
              </div>
            </div>
          ) : (
            <AssistantMessage
              key={i}
              content={msg.content}
              streaming={msg.streaming}
            />
          )
        )}

        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold">
              M
            </div>
            <div className="glass-card rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
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
            placeholder={
              mode === "lesson"
                ? "Type your answer or question…"
                : "Scríobh anseo… (Write here…)"
            }
            rows={1}
            className="flex-1 resize-none rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all max-h-32 overflow-y-auto"
            style={{ minHeight: "44px" }}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-surface-200 disabled:text-surface-400 text-white flex items-center justify-center transition-all duration-150 active:scale-95"
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
