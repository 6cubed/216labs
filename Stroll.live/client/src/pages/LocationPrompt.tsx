import { useState } from "react";
import { useLocation } from "wouter";

export function LocationPrompt() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleUseBrowserLocation = () => {
    setStatus("Getting location…");
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation not supported by your browser");
      setStatus("");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setStatus("Finding your neighbourhood…");
        try {
          const res = await fetch(`/api/segment?lat=${lat}&lon=${lon}`);
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(data.error || "No active segment for this location yet");
            setStatus("");
            return;
          }
          const segment = await res.json();
          setLocation(`/feed?lat=${lat}&lon=${lon}&segmentId=${segment.id}`);
        } catch {
          setError("Network error — try again");
          setStatus("");
        }
      },
      () => {
        setError("Location access denied or unavailable");
        setStatus("");
      }
    );
  };

  const isLoading = !!status;

  return (
    <div className="min-h-screen bg-zinc-950 bg-mesh flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Floating orbs */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      <div className="absolute top-2/3 left-1/3 w-48 h-48 bg-violet-500/6 rounded-full blur-3xl animate-float" style={{ animationDelay: "4s" }} />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md animate-fade-in">
        {/* Pin icon */}
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center glow-emerald">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-emerald-500/20 animate-ping-slow opacity-40" />
        </div>

        {/* Title */}
        <h1 className="text-5xl font-extrabold tracking-tight mb-3">
          <span className="text-gradient">Stroll</span>
          <span className="text-zinc-300">.live</span>
        </h1>
        <p className="text-zinc-400 text-lg leading-relaxed mb-10 max-w-xs">
          See what's happening around you, right now.
        </p>

        {/* CTA */}
        <button
          type="button"
          onClick={handleUseBrowserLocation}
          disabled={isLoading}
          className="group relative px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30 hover:shadow-emerald-800/40 hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="flex items-center gap-3">
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {status}
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="1" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                </svg>
                Share location &amp; open feed
              </>
            )}
          </span>
        </button>

        {/* Error */}
        {error && (
          <div className="mt-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-slide-up">
            {error}
          </div>
        )}

        {/* Admin link */}
        <a
          href="/admin"
          className="mt-12 text-zinc-600 text-sm hover:text-zinc-400 transition-colors flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          Admin
        </a>
      </div>
    </div>
  );
}
