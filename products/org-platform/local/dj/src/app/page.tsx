"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DeckId = "A" | "B";

type DeckState = {
  name: string | null;
  url: string | null;
  duration: number | null;
  ready: boolean;
  playing: boolean;
  volume: number; // 0..1
  offsetSeconds: number; // applied on (re)start/sync
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function deckLabel(id: DeckId) {
  return id === "A" ? "Deck A" : "Deck B";
}

export default function Page() {
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crossfade, setCrossfade] = useState(0.5); // 0..1 (A..B)

  const [deckA, setDeckA] = useState<DeckState>({
    name: null,
    url: null,
    duration: null,
    ready: false,
    playing: false,
    volume: 1,
    offsetSeconds: 0,
  });
  const [deckB, setDeckB] = useState<DeckState>({
    name: null,
    url: null,
    duration: null,
    ready: false,
    playing: false,
    volume: 1,
    offsetSeconds: 0,
  });

  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceARef = useRef<MediaElementAudioSourceNode | null>(null);
  const sourceBRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);

  const deck = useMemo(
    () => ({
      A: { state: deckA, setState: setDeckA, audioRef: audioARef, gainRef: gainARef, sourceRef: sourceARef },
      B: { state: deckB, setState: setDeckB, audioRef: audioBRef, gainRef: gainBRef, sourceRef: sourceBRef },
    }),
    [deckA, deckB],
  );

  // Init audio graph once.
  useEffect(() => {
    const AudioCtx = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      setSupported(false);
      return;
    }
    const ctx = new AudioCtx();
    ctxRef.current = ctx;

    const gainA = ctx.createGain();
    const gainB = ctx.createGain();
    gainA.gain.value = 1;
    gainB.gain.value = 1;
    gainA.connect(ctx.destination);
    gainB.connect(ctx.destination);
    gainARef.current = gainA;
    gainBRef.current = gainB;

    return () => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    };
  }, []);

  // Apply crossfade + per-deck volume.
  useEffect(() => {
    const gainA = gainARef.current;
    const gainB = gainBRef.current;
    if (!gainA || !gainB) return;

    // Equal-power crossfade
    const x = clamp(crossfade, 0, 1);
    const a = Math.cos(x * 0.5 * Math.PI);
    const b = Math.cos((1 - x) * 0.5 * Math.PI);

    gainA.gain.value = a * clamp(deckA.volume, 0, 1);
    gainB.gain.value = b * clamp(deckB.volume, 0, 1);
  }, [crossfade, deckA.volume, deckB.volume]);

  const ensureConnected = (id: DeckId) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const el = deck[id].audioRef.current;
    if (!el) return;
    if (deck[id].sourceRef.current) return;
    try {
      const src = ctx.createMediaElementSource(el);
      src.connect(deck[id].gainRef.current!);
      deck[id].sourceRef.current = src;
    } catch (e) {
      // createMediaElementSource can throw if the element is already connected in another graph.
      console.error(e);
      setError("Audio graph init failed. If you reloaded tracks, try refreshing the page.");
    }
  };

  const resumeIfSuspended = async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();
  };

  const loadFromFile = (id: DeckId, file: File) => {
    setError(null);
    const url = URL.createObjectURL(file);
    deck[id].setState((s) => ({
      ...s,
      name: file.name,
      url,
      duration: null,
      ready: false,
      playing: false,
    }));
  };

  const loadFromUrl = (id: DeckId, url: string) => {
    setError(null);
    deck[id].setState((s) => ({
      ...s,
      name: url.trim(),
      url: url.trim(),
      duration: null,
      ready: false,
      playing: false,
    }));
  };

  const onLoadedMetadata = (id: DeckId) => {
    const el = deck[id].audioRef.current;
    if (!el) return;
    deck[id].setState((s) => ({
      ...s,
      duration: Number.isFinite(el.duration) ? el.duration : null,
      ready: true,
    }));
    ensureConnected(id);
  };

  const stop = (id: DeckId) => {
    const el = deck[id].audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    deck[id].setState((s) => ({ ...s, playing: false }));
  };

  const play = async (id: DeckId) => {
    const el = deck[id].audioRef.current;
    if (!el) return;
    await resumeIfSuspended();
    ensureConnected(id);
    try {
      const offset = clamp(deck[id].state.offsetSeconds, 0, 60 * 60);
      if (offset > 0 && el.currentTime === 0) el.currentTime = offset;
      await el.play();
      deck[id].setState((s) => ({ ...s, playing: true }));
    } catch (e) {
      console.error(e);
      setError("Playback failed. This can happen if the browser blocks autoplay—click play again.");
    }
  };

  const pause = (id: DeckId) => {
    const el = deck[id].audioRef.current;
    if (!el) return;
    el.pause();
    deck[id].setState((s) => ({ ...s, playing: false }));
  };

  const syncStart = async () => {
    // Start both decks at their offsets, from time 0.
    setError(null);
    await resumeIfSuspended();
    for (const id of ["A", "B"] as const) {
      const el = deck[id].audioRef.current;
      if (!el) continue;
      ensureConnected(id);
      el.pause();
      el.currentTime = clamp(deck[id].state.offsetSeconds, 0, 60 * 60);
    }
    try {
      await Promise.all((["A", "B"] as const).map((id) => deck[id].audioRef.current?.play()));
      setDeckA((s) => ({ ...s, playing: true }));
      setDeckB((s) => ({ ...s, playing: true }));
    } catch (e) {
      console.error(e);
      setError("Sync start failed—your browser may require a user gesture. Click Play on each deck first.");
    }
  };

  if (!supported) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem 3rem" }}>
        <h1 style={{ marginTop: 0 }}>DJ</h1>
        <p style={{ color: "#b8c9f0" }}>
          This browser does not support the Web Audio API (AudioContext). Try Chrome, Edge, or Safari.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "2rem 1rem 3rem" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "2.1rem" }}>DJ</h1>
          <p style={{ margin: "0.35rem 0 0", color: "#a9bdf0", maxWidth: 760 }}>
            Load two audio tracks (local files or direct URLs), then overlay them with a crossfader. This app does not
            download from YouTube—use files you already have.
          </p>
        </div>
        <button
          type="button"
          onClick={syncStart}
          style={{
            background: "rgba(71, 170, 255, 0.18)",
            color: "#eaf2ff",
            border: "1px solid rgba(120, 190, 255, 0.35)",
            borderRadius: 10,
            padding: "0.65rem 0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Sync start
        </button>
      </header>

      {error ? (
        <div
          style={{
            marginTop: 14,
            padding: "0.75rem 0.9rem",
            borderRadius: 12,
            border: "1px solid rgba(255, 120, 120, 0.35)",
            background: "rgba(255, 80, 80, 0.08)",
            color: "#ffd1d1",
          }}
        >
          {error}
        </div>
      ) : null}

      <section style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        <div
          style={{
            border: "1px solid rgba(120, 150, 220, 0.25)",
            background: "linear-gradient(180deg, rgba(28, 45, 92, 0.35), rgba(14, 20, 40, 0.35))",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 800, color: "#eaf2ff" }}>Mixer</div>
            <div style={{ color: "#a9bdf0", fontSize: 13 }}>
              Crossfade: <span style={{ fontWeight: 800 }}>{Math.round(crossfade * 100)}%</span> to B
            </div>
          </div>
          <input
            aria-label="Crossfader"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={crossfade}
            onChange={(e) => setCrossfade(Number(e.target.value))}
            style={{ width: "100%", marginTop: 10 }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {(["A", "B"] as const).map((id) => {
            const s = deck[id].state;
            return (
              <section
                key={id}
                style={{
                  border: "1px solid rgba(120, 150, 220, 0.25)",
                  background: "rgba(10, 14, 30, 0.45)",
                  borderRadius: 16,
                  padding: 14,
                  minHeight: 260,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 14, color: "#a9bdf0" }}>{deckLabel(id)}</div>
                    <div style={{ fontWeight: 900, marginTop: 4, lineHeight: 1.2 }}>
                      {s.name ?? <span style={{ color: "#7e93c9" }}>No track loaded</span>}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#7e93c9" }}>
                      Duration: {formatTime(s.duration)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {s.playing ? (
                      <button
                        type="button"
                        onClick={() => pause(id)}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          color: "#eef3ff",
                          border: "1px solid rgba(255,255,255,0.14)",
                          borderRadius: 10,
                          padding: "0.55rem 0.75rem",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => play(id)}
                        disabled={!s.url}
                        style={{
                          background: s.url ? "rgba(71, 170, 255, 0.18)" : "rgba(255,255,255,0.04)",
                          color: "#eef3ff",
                          border: "1px solid rgba(120, 190, 255, 0.35)",
                          borderRadius: 10,
                          padding: "0.55rem 0.75rem",
                          fontWeight: 900,
                          cursor: s.url ? "pointer" : "not-allowed",
                          opacity: s.url ? 1 : 0.6,
                        }}
                      >
                        Play
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => stop(id)}
                      disabled={!s.url}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "#eef3ff",
                        border: "1px solid rgba(255,255,255,0.14)",
                        borderRadius: 10,
                        padding: "0.55rem 0.75rem",
                        fontWeight: 800,
                        cursor: s.url ? "pointer" : "not-allowed",
                        opacity: s.url ? 1 : 0.6,
                      }}
                    >
                      Stop
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#a9bdf0", fontWeight: 800 }}>Load from file</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0];
                        if (f) loadFromFile(id, f);
                      }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#a9bdf0", fontWeight: 800 }}>Or load from URL</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="url"
                        placeholder="https://…/track.mp3"
                        defaultValue=""
                        onKeyDown={(e) => {
                          if (e.key === "Enter") loadFromUrl(id, (e.currentTarget as HTMLInputElement).value);
                        }}
                        style={{
                          flex: 1,
                          padding: "0.55rem 0.6rem",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.16)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#eef3ff",
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = (e.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null);
                          if (input?.value) loadFromUrl(id, input.value);
                        }}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          color: "#eef3ff",
                          border: "1px solid rgba(255,255,255,0.14)",
                          borderRadius: 10,
                          padding: "0.55rem 0.75rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Load
                      </button>
                    </div>
                    <span style={{ fontSize: 11, color: "#7e93c9" }}>
                      URL must allow browser playback (CORS). YouTube links won’t work here.
                    </span>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#a9bdf0", fontWeight: 800 }}>
                      Volume ({Math.round(s.volume * 100)}%)
                    </span>
                    <input
                      aria-label={`${deckLabel(id)} volume`}
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={s.volume}
                      onChange={(e) => deck[id].setState((x) => ({ ...x, volume: Number(e.target.value) }))}
                      style={{ width: "100%" }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#a9bdf0", fontWeight: 800 }}>
                      Start offset ({s.offsetSeconds.toFixed(2)}s)
                    </span>
                    <input
                      aria-label={`${deckLabel(id)} start offset`}
                      type="range"
                      min={0}
                      max={15}
                      step={0.05}
                      value={s.offsetSeconds}
                      onChange={(e) => deck[id].setState((x) => ({ ...x, offsetSeconds: Number(e.target.value) }))}
                      style={{ width: "100%" }}
                    />
                    <span style={{ fontSize: 11, color: "#7e93c9" }}>
                      Applied on Play when the deck is at 0:00, or when you hit Sync start.
                    </span>
                  </label>
                </div>

                <audio
                  ref={(el) => {
                    deck[id].audioRef.current = el;
                  }}
                  src={s.url ?? undefined}
                  preload="metadata"
                  crossOrigin="anonymous"
                  onLoadedMetadata={() => onLoadedMetadata(id)}
                  onPlay={() => deck[id].setState((x) => ({ ...x, playing: true }))}
                  onPause={() => deck[id].setState((x) => ({ ...x, playing: false }))}
                  onError={() => {
                    deck[id].setState((x) => ({ ...x, ready: false, duration: null, playing: false }));
                    setError("Could not load audio. If using a URL, it may block playback (CORS) or be unsupported.");
                  }}
                  style={{ display: "none" }}
                />
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}

