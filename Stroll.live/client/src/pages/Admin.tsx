import { useEffect, useState } from "react";
import { Link } from "wouter";

type Segment = {
  id: number;
  name: string;
  slug: string;
  country: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

const FLAG: Record<string, string> = {
  Ireland: "IE",
  Switzerland: "CH",
};

function countryCode(country: string) {
  const code = FLAG[country] ?? country.slice(0, 2).toUpperCase();
  return [...code].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

export function Admin() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/segments")
      .then((r) => r.json())
      .then(setSegments)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 bg-mesh">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-zinc-800/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <h1 className="text-base font-bold">Segments</h1>
          </div>
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Home
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-6 animate-fade-in">
          <div className="glass-light rounded-xl px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-bold text-gradient">{segments.length}</p>
            <p className="text-zinc-500 text-xs mt-0.5">Active segments</p>
          </div>
          <div className="glass-light rounded-xl px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-bold text-zinc-300">
              {new Set(segments.map((s) => s.country)).size}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">Countries</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin h-6 w-6 text-emerald-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div className="grid gap-3">
            {segments.map((s, i) => (
              <Link
                key={s.id}
                href={`/feed?segmentId=${s.id}&lat=${(s.minLat + s.maxLat) / 2}&lon=${(s.minLon + s.maxLon) / 2}`}
                className="group glass-light rounded-2xl p-4 flex items-center gap-4 hover:border-emerald-500/30 transition-all duration-200 hover:bg-zinc-800/40 animate-fade-in-up cursor-pointer"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
              >
                <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-xl shrink-0">
                  {countryCode(s.country)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-zinc-200 group-hover:text-white transition-colors">{s.name}</h2>
                  <p className="text-zinc-500 text-sm">{s.country}</p>
                </div>
                <div className="text-zinc-600 group-hover:text-emerald-400 transition-colors shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
