"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DeckId = "A" | "B";

type DeckState = {
  name: string | null;
  url: string | null;
  duration: number | null;
  ready: boolean;
  playing: boolean;
  volume: number;
  offsetSeconds: number;
  /** 0.85–1.15 — HTMLMediaElement playbackRate */
  tempo: number;
  /** 0 = wide open, 1 = heavy low-pass (DJ-style filter) */
  filterAmount: number;
  /** Display only, updated from audio + rAF */
  positionSeconds: number;
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

/** Map 0..1 to low-pass cutoff Hz (bright → muffled) */
function filterHz(amount: number) {
  const a = clamp(amount, 0, 1);
  const minF = 320;
  const maxF = 20000;
  return maxF * Math.pow(minF / maxF, a);
}

export default function Page() {
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crossfade, setCrossfade] = useState(0.5);
  const [master, setMaster] = useState(1);

  const [deckA, setDeckA] = useState<DeckState>({
    name: null,
    url: null,
    duration: null,
    ready: false,
    playing: false,
    volume: 1,
    offsetSeconds: 0,
    tempo: 1,
    filterAmount: 0,
    positionSeconds: 0,
  });
  const [deckB, setDeckB] = useState<DeckState>({
    name: null,
    url: null,
    duration: null,
    ready: false,
    playing: false,
    volume: 1,
    offsetSeconds: 0,
    tempo: 1,
    filterAmount: 0,
    positionSeconds: 0,
  });

  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);

  const sourceARef = useRef<MediaElementAudioSourceNode | null>(null);
  const sourceBRef = useRef<MediaElementAudioSourceNode | null>(null);

  const filterARef = useRef<BiquadFilterNode | null>(null);
  const filterBRef = useRef<BiquadFilterNode | null>(null);
  const analyserARef = useRef<AnalyserNode | null>(null);
  const analyserBRef = useRef<AnalyserNode | null>(null);
  const userGainARef = useRef<GainNode | null>(null);
  const userGainBRef = useRef<GainNode | null>(null);
  const xfGainARef = useRef<GainNode | null>(null);
  const xfGainBRef = useRef<GainNode | null>(null);

  const vuARef = useRef<HTMLDivElement | null>(null);
  const vuBRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const deck = useMemo(
    () => ({
      A: {
        state: deckA,
        setState: setDeckA,
        audioRef: audioARef,
        sourceRef: sourceARef,
        filterRef: filterARef,
        analyserRef: analyserARef,
        userGainRef: userGainARef,
        xfGainRef: xfGainARef,
        vuRef: vuARef,
      },
      B: {
        state: deckB,
        setState: setDeckB,
        audioRef: audioBRef,
        sourceRef: sourceBRef,
        filterRef: filterBRef,
        analyserRef: analyserBRef,
        userGainRef: userGainBRef,
        xfGainRef: xfGainBRef,
        vuRef: vuBRef,
      },
    }),
    [deckA, deckB],
  );

  // Init graph: master + per-deck chains (no media sources yet).
  useEffect(() => {
    const AudioCtx =
      (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      setSupported(false);
      return;
    }
    const ctx = new AudioCtx();
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    masterRef.current = master;

    const makeDeckChain = () => {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = filterHz(0);
      filter.Q.value = 0.7;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;

      const userGain = ctx.createGain();
      userGain.gain.value = 1;

      const xfGain = ctx.createGain();
      xfGain.gain.value = 1;

      filter.connect(analyser);
      analyser.connect(userGain);
      userGain.connect(xfGain);
      xfGain.connect(master);

      return { filter, analyser, userGain, xfGain };
    };

    const a = makeDeckChain();
    filterARef.current = a.filter;
    analyserARef.current = a.analyser;
    userGainARef.current = a.userGain;
    xfGainARef.current = a.xfGain;

    const b = makeDeckChain();
    filterBRef.current = b.filter;
    analyserBRef.current = b.analyser;
    userGainBRef.current = b.userGain;
    xfGainBRef.current = b.xfGain;

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Crossfade + per-deck volume + master.
  useEffect(() => {
    const ua = userGainARef.current;
    const ub = userGainBRef.current;
    const xa = xfGainARef.current;
    const xb = xfGainBRef.current;
    const m = masterRef.current;
    if (!ua || !ub || !xa || !xb || !m) return;

    const x = clamp(crossfade, 0, 1);
    const a = Math.cos(x * 0.5 * Math.PI);
    const b = Math.cos((1 - x) * 0.5 * Math.PI);

    ua.gain.value = clamp(deckA.volume, 0, 1);
    ub.gain.value = clamp(deckB.volume, 0, 1);
    xa.gain.value = a;
    xb.gain.value = b;
    m.gain.value = clamp(master, 0, 1);
  }, [crossfade, deckA.volume, deckB.volume, master]);

  // Per-deck filter + tempo on <audio>
  useEffect(() => {
    const fa = filterARef.current;
    if (fa) fa.frequency.value = filterHz(deckA.filterAmount);
  }, [deckA.filterAmount]);
  useEffect(() => {
    const fb = filterBRef.current;
    if (fb) fb.frequency.value = filterHz(deckB.filterAmount);
  }, [deckB.filterAmount]);

  useEffect(() => {
    const el = audioARef.current;
    if (el) el.playbackRate = clamp(deckA.tempo, 0.5, 1.5);
  }, [deckA.tempo]);
  useEffect(() => {
    const el = audioBRef.current;
    if (el) el.playbackRate = clamp(deckB.tempo, 0.5, 1.5);
  }, [deckB.tempo]);

  const ensureConnected = useCallback((id: DeckId) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const el = deck[id].audioRef.current;
    const filter = deck[id].filterRef.current;
    if (!el || !filter) return;
    if (deck[id].sourceRef.current) return;
    try {
      const src = ctx.createMediaElementSource(el);
      src.connect(filter);
      deck[id].sourceRef.current = src;
    } catch (e) {
      console.error(e);
      setError("Audio routing failed. Refresh the page if you swapped tracks.");
    }
  }, [deck]);

  const resumeIfSuspended = async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();
  };

  // VU meters (cheap RMS from time domain)
  useEffect(() => {
    const bufA = new Uint8Array(256);
    const bufB = new Uint8Array(256);

    const tick = () => {
      const aa = analyserARef.current;
      const ab = analyserBRef.current;
      const va = vuARef.current;
      const vb = vuBRef.current;

      if (aa && va) {
        aa.getByteTimeDomainData(bufA);
        let sum = 0;
        for (let i = 0; i < bufA.length; i++) {
          const v = (bufA[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / bufA.length);
        va.style.transform = `scaleY(${clamp(0.08 + rms * 4.5, 0.05, 1)})`;
      }
      if (ab && vb) {
        ab.getByteTimeDomainData(bufB);
        let sum = 0;
        for (let i = 0; i < bufB.length; i++) {
          const v = (bufB[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / bufB.length);
        vb.style.transform = `scaleY(${clamp(0.08 + rms * 4.5, 0.05, 1)})`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const syncPositionFromAudio = useCallback((id: DeckId) => {
    const el = deck[id].audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    deck[id].setState((s) => ({ ...s, positionSeconds: el.currentTime }));
  }, [deck]);

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
      positionSeconds: 0,
    }));
  };

  const loadFromUrl = (id: DeckId, url: string) => {
    setError(null);
    const u = url.trim();
    deck[id].setState((s) => ({
      ...s,
      name: u,
      url: u,
      duration: null,
      ready: false,
      playing: false,
      positionSeconds: 0,
    }));
  };

  const onLoadedMetadata = (id: DeckId) => {
    const el = deck[id].audioRef.current;
    if (!el) return;
    deck[id].setState((s) => ({
      ...s,
      duration: Number.isFinite(el.duration) ? el.duration : null,
      ready: true,
      positionSeconds: el.currentTime,
    }));
    ensureConnected(id);
  };

  const stop = (id: DeckId) => {
    const el = deck[id].audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    deck[id].setState((s) => ({ ...s, playing: false, positionSeconds: 0 }));
  };

  const play = async (id: DeckId) => {
    const el = deck[id].audioRef.current;
    if (!el) return;
    await resumeIfSuspended();
    ensureConnected(id);
    try {
      const offset = clamp(deck[id].state.offsetSeconds, 0, 60 * 60);
      if (offset > 0 && el.currentTime < 0.05) el.currentTime = offset;
      await el.play();
      deck[id].setState((s) => ({ ...s, playing: true }));
    } catch (e) {
      console.error(e);
      setError("Playback blocked or failed — tap Play again (browser autoplay rules).");
    }
  };

  const pause = (id: DeckId) => {
    const el = deck[id].audioRef.current;
    if (!el) return;
    el.pause();
    deck[id].setState((s) => ({ ...s, playing: false }));
  };

  const seek = (id: DeckId, t: number) => {
    const el = deck[id].audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = clamp(t, 0, el.duration);
    deck[id].setState((s) => ({ ...s, positionSeconds: el.currentTime }));
  };

  const syncStart = async () => {
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
      setError("Sync start needs a tap first — press Play on one deck, then Sync start.");
    }
  };

  const offsetMax = (d: number | null) => {
    if (d == null || !Number.isFinite(d) || d <= 0) return 60;
    return clamp(d - 0.25, 5, 300);
  };

  if (!supported) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem 3rem" }}>
        <h1 style={{ marginTop: 0 }}>DJ</h1>
        <p style={{ color: "#b8c9f0" }}>Web Audio (AudioContext) not available. Use Chrome, Edge, or Safari.</p>
      </main>
    );
  }

  const btn = (active: boolean) =>
    ({
      background: active ? "rgba(71, 170, 255, 0.22)" : "rgba(255,255,255,0.06)",
      color: "#eef3ff",
      border: `1px solid ${active ? "rgba(120, 190, 255, 0.45)" : "rgba(255,255,255,0.14)"}`,
      borderRadius: 10,
      padding: "0.55rem 0.75rem",
      fontWeight: 800,
      cursor: "pointer",
    }) as const;

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "2rem 1rem 3rem" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "2.1rem", letterSpacing: "-0.02em" }}>DJ</h1>
          <p style={{ margin: "0.35rem 0 0", color: "#a9bdf0", maxWidth: 720, lineHeight: 1.55 }}>
            Two-deck mixer in your browser: <strong style={{ color: "#eaf2ff" }}>filter</strong>,{" "}
            <strong style={{ color: "#eaf2ff" }}>tempo</strong>, <strong style={{ color: "#eaf2ff" }}>seek</strong>,{" "}
            <strong style={{ color: "#eaf2ff" }}>VU</strong>, crossfader, and master. Load local files or direct audio URLs
            (CORS). For YouTube audio, export to a file first (e.g. yt-dlp locally)—this page does not rip streams.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={syncStart} style={btn(true)}>
            Sync start
          </button>
          <button
            type="button"
            onClick={() => {
              pause("A");
              pause("B");
            }}
            style={btn(false)}
          >
            Pause all
          </button>
        </div>
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

      <section style={{ marginTop: 18, display: "grid", gap: 14 }}>
        <div
          style={{
            border: "1px solid rgba(120, 150, 220, 0.25)",
            background: "linear-gradient(180deg, rgba(28, 45, 92, 0.45), rgba(14, 20, 40, 0.4))",
            borderRadius: 16,
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, color: "#eaf2ff", fontSize: 15 }}>Mixer</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ color: "#a9bdf0", fontSize: 13 }}>
                Crossfade → B: <span style={{ fontWeight: 900, color: "#eaf2ff" }}>{Math.round(crossfade * 100)}%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
                <span style={{ fontSize: 12, color: "#a9bdf0", fontWeight: 800, whiteSpace: "nowrap" }}>
                  Master {Math.round(master * 100)}%
                </span>
                <input
                  aria-label="Master volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={master}
                  onChange={(e) => setMaster(Number(e.target.value))}
                  style={{ width: 120 }}
                />
              </div>
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
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#7e93c9", fontWeight: 800 }}>A</span>
              <div
                ref={vuARef}
                style={{
                  width: 14,
                  height: 72,
                  borderRadius: 6,
                  background: "linear-gradient(180deg, #47aaff 0%, #1a3a6e 100%)",
                  transformOrigin: "bottom",
                  transform: "scaleY(0.08)",
                  opacity: 0.95,
                }}
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#7e93c9", fontWeight: 800 }}>B</span>
              <div
                ref={vuBRef}
                style={{
                  width: 14,
                  height: 72,
                  borderRadius: 6,
                  background: "linear-gradient(180deg, #7cffc4 0%, #1a5c45 100%)",
                  transformOrigin: "bottom",
                  transform: "scaleY(0.08)",
                  opacity: 0.95,
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
            gap: 14,
          }}
        >
          {(["A", "B"] as const).map((id) => {
            const s = deck[id].state;
            const dur = s.duration;
            const pos = s.positionSeconds;
            return (
              <section
                key={id}
                style={{
                  border: "1px solid rgba(120, 150, 220, 0.25)",
                  background: "rgba(10, 14, 30, 0.55)",
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 12, color: "#7c9dff", letterSpacing: "0.06em" }}>
                      {deckLabel(id)}
                    </div>
                    <div style={{ fontWeight: 800, marginTop: 4, lineHeight: 1.25, wordBreak: "break-word" }}>
                      {s.name ?? <span style={{ color: "#7e93c9" }}>Drop a track</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {s.playing ? (
                      <button type="button" onClick={() => pause(id)} style={btn(false)}>
                        Pause
                      </button>
                    ) : (
                      <button type="button" onClick={() => play(id)} disabled={!s.url} style={btn(!!s.url)}>
                        Play
                      </button>
                    )}
                    <button type="button" onClick={() => stop(id)} disabled={!s.url} style={btn(false)}>
                      Stop
                    </button>
                  </div>
                </div>

                {/* Transport */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "#9eb4e8",
                      marginBottom: 6,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <span>{formatTime(pos)}</span>
                    <span>{formatTime(dur)}</span>
                  </div>
                  <input
                    aria-label={`${deckLabel(id)} position`}
                    type="range"
                    min={0}
                    max={dur && dur > 0 ? dur : 1}
                    step={0.05}
                    value={dur && dur > 0 ? clamp(pos, 0, dur) : 0}
                    disabled={!dur || dur <= 0}
                    onChange={(e) => seek(id, Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#a9bdf0", fontWeight: 800 }}>Load file</span>
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
                    <span style={{ fontSize: 12, color: "#a9bdf0", fontWeight: 800 }}>Or URL</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="url"
                        placeholder="https://…/track.mp3"
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
                          const input = e.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null;
                          if (input?.value) loadFromUrl(id, input.value);
                        }}
                        style={btn(false)}
                      >
                        Load
                      </button>
                    </div>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#a9bdf0", fontWeight: 800 }}>
                      Filter ({Math.round(s.filterAmount * 100)}% damp)
                    </span>
                    <input
                      aria-label={`${deckLabel(id)} filter`}
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={s.filterAmount}
                      onChange={(e) => deck[id].setState((x) => ({ ...x, filterAmount: Number(e.target.value) }))}
                      style={{ width: "100%" }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#a9bdf0", fontWeight: 800 }}>
                      Tempo ×{s.tempo.toFixed(2)}
                    </span>
                    <input
                      aria-label={`${deckLabel(id)} tempo`}
                      type="range"
                      min={0.85}
                      max={1.15}
                      step={0.01}
                      value={s.tempo}
                      onChange={(e) => deck[id].setState((x) => ({ ...x, tempo: Number(e.target.value) }))}
                      style={{ width: "100%" }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#a9bdf0", fontWeight: 800 }}>
                      Trim in / cue ({s.offsetSeconds.toFixed(2)}s)
                    </span>
                    <input
                      aria-label={`${deckLabel(id)} cue offset`}
                      type="range"
                      min={0}
                      max={offsetMax(dur)}
                      step={0.05}
                      value={clamp(s.offsetSeconds, 0, offsetMax(dur))}
                      onChange={(e) =>
                        deck[id].setState((x) => ({ ...x, offsetSeconds: Number(e.target.value) }))
                      }
                      style={{ width: "100%" }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#a9bdf0", fontWeight: 800 }}>
                      Channel ({Math.round(s.volume * 100)}%)
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
                </div>

                <audio
                  ref={(el) => {
                    deck[id].audioRef.current = el;
                  }}
                  src={s.url ?? undefined}
                  preload="metadata"
                  crossOrigin={s.url?.startsWith("http") ? "anonymous" : undefined}
                  onLoadedMetadata={() => onLoadedMetadata(id)}
                  onTimeUpdate={() => syncPositionFromAudio(id)}
                  onPlay={() => deck[id].setState((x) => ({ ...x, playing: true }))}
                  onPause={() => deck[id].setState((x) => ({ ...x, playing: false }))}
                  onEnded={() => deck[id].setState((x) => ({ ...x, playing: false, positionSeconds: 0 }))}
                  onError={() => {
                    deck[id].setState((x) => ({ ...x, ready: false, duration: null, playing: false }));
                    setError("Load failed — check format / CORS for URLs.");
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
