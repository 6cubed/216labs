import { useEffect, useState, useRef } from "react";
import { useSearch } from "wouter";

function timeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Feed() {
  const query = new URLSearchParams(useSearch());
  const lat = query.get("lat");
  const lon = query.get("lon");
  const segmentId = query.get("segmentId");
  const [segment, setSegment] = useState<{ id: number; name: string; country: string } | null>(null);
  const [content, setContent] = useState<{ id: number; body: string; authorName: string; authorHue: number; createdAt: number }[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!segmentId) return;
    (async () => {
      try {
        const [segRes, conRes] = await Promise.all([
          fetch(`/api/segments/${segmentId}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/segments/${segmentId}/content`).then((r) => r.json()),
        ]);
        if (segRes) setSegment(segRes);
        setContent(Array.isArray(conRes) ? conRes : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [segmentId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !lat || !lon || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: Number(lat), lon: Number(lon), body: body.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to post");
        return;
      }
      const newRow = await res.json();
      setContent((prev) => [newRow, ...prev]);
      setBody("");
      textareaRef.current?.focus();
    } catch {
      alert("Network error");
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 bg-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <svg className="animate-spin h-6 w-6 text-emerald-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-zinc-500 text-sm">Loading feed…</span>
        </div>
      </div>
    );
  }

  if (!segment) {
    return (
      <div className="min-h-screen bg-zinc-950 bg-mesh flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-zinc-400">Segment not found</p>
        <a href="/" className="text-emerald-400 text-sm hover:underline">Back home</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 bg-mesh">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-zinc-800/50">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">{segment.name}</h1>
              <p className="text-zinc-500 text-xs">{segment.country}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </div>
            <a href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="1" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pb-8">
        {/* Compose */}
        <form onSubmit={submit} className="mt-4 mb-6 glass-light rounded-2xl p-4 animate-fade-in-up">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's happening nearby?"
            rows={3}
            className="w-full bg-transparent text-zinc-100 placeholder-zinc-600 resize-none outline-none text-[15px] leading-relaxed"
          />
          <div className="flex items-center justify-between mt-2 pt-3 border-t border-zinc-700/30">
            <span className="text-zinc-600 text-xs">
              {body.length > 0 ? `${body.length} chars` : "Share with your neighbourhood"}
            </span>
            <button
              type="submit"
              disabled={!body.trim() || posting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </form>

        {/* Posts */}
        {content.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-zinc-500 font-medium">No posts yet</p>
            <p className="text-zinc-600 text-sm mt-1">Be the first to share something.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {content.map((c, i) => (
              <li
                key={c.id}
                className="glass-light rounded-2xl p-4 animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i * 50, 300)}ms`, animationFillMode: "both" }}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{
                      backgroundColor: `hsl(${c.authorHue}, 50%, 25%)`,
                      color: `hsl(${c.authorHue}, 70%, 75%)`,
                      border: `1px solid hsl(${c.authorHue}, 50%, 35%)`,
                    }}
                  >
                    {(c.authorName || "A")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: `hsl(${c.authorHue}, 60%, 70%)` }}
                      >
                        {c.authorName || "Anonymous"}
                      </span>
                      <span className="text-zinc-600 text-xs">
                        {c.createdAt ? timeAgo(c.createdAt) : ""}
                      </span>
                    </div>
                    <p className="text-zinc-200 text-[15px] leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
