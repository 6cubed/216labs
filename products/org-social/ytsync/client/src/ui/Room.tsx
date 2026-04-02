import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadYouTubeApi, parseYouTubeVideoId } from "./youtube";
import { makeWsUrl } from "./ws";
import type { ClientToServer, Presence, RoomState, ServerToClient } from "./types";

function goto(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function computeExpectedPosition(state: RoomState, serverTimeMs: number, clientNowMs: number): number {
  if (state.paused) return state.position;
  const dt = Math.max(0, clientNowMs - serverTimeMs) / 1000;
  return state.position + dt * state.playbackRate;
}

export function Room({ roomId }: { roomId: string }) {
  const [name, setName] = useState(() => localStorage.getItem("ytsync:name") || "Guest");
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [users, setUsers] = useState<Presence[]>([]);
  const [state, setState] = useState<RoomState | null>(null);
  const [serverTimeMs, setServerTimeMs] = useState<number>(Date.now());
  const [videoInput, setVideoInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [needsClickToPlay, setNeedsClickToPlay] = useState(false);
  const [autoplayAssist, setAutoplayAssist] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<any>(null);
  const applyingRemoteRef = useRef(false);
  const lastAppliedVersionRef = useRef<number>(0);

  const inviteUrl = useMemo(() => `${window.location.origin}/r/${roomId}`, [roomId]);

  useEffect(() => {
    localStorage.setItem("ytsync:name", name);
  }, [name]);

  useEffect(() => {
    setErr(null);
    setWsStatus("connecting");
    setUsers([]);
    setState(null);

    const ws = new WebSocket(makeWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("open");
      const join: ClientToServer = { type: "join", roomId, name };
      ws.send(JSON.stringify(join));
    };
    ws.onclose = () => setWsStatus("closed");
    ws.onerror = () => setErr("WebSocket error");
    ws.onmessage = (ev) => {
      const parsed = (() => {
        try {
          return JSON.parse(ev.data) as ServerToClient;
        } catch {
          return null;
        }
      })();
      if (!parsed) return;
      if (parsed.type === "hello") {
        setSelfId(parsed.selfId);
        setServerTimeMs(parsed.serverTime);
        return;
      }
      if (parsed.type === "error") {
        setErr(parsed.message);
        return;
      }
      if (parsed.type === "presence" && parsed.roomId === roomId) {
        setUsers(parsed.users);
        setServerTimeMs(parsed.serverTime);
        return;
      }
      if (parsed.type === "state" && parsed.roomId === roomId) {
        setServerTimeMs(parsed.serverTime);
        setState((prev) => {
          if (!prev) return parsed.state;
          if (parsed.state.version < prev.version) return prev;
          return parsed.state;
        });
        return;
      }
    };

    return () => {
      ws.close();
    };
  }, [roomId, name]);

  // YouTube player setup (once).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const YT = await loadYouTubeApi();
      if (cancelled) return;
      const el = document.getElementById("yt-player");
      if (!el) return;

      playerRef.current = new YT.Player("yt-player", {
        height: "390",
        width: "640",
        videoId: undefined,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onStateChange: () => {
            if (applyingRemoteRef.current) return;
            const ws = wsRef.current;
            const p = playerRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN || !p) return;
            const ytState = p.getPlayerState?.();
            const t = Number(p.getCurrentTime?.() || 0);
            // If user clicked the iframe, clear any autoplay-block hint.
            if (ytState === 1) setNeedsClickToPlay(false);
            // 1 = playing, 2 = paused
            if (ytState === 1) ws.send(JSON.stringify({ type: "play", roomId, at: t } satisfies ClientToServer));
            if (ytState === 2) ws.send(JSON.stringify({ type: "pause", roomId, at: t } satisfies ClientToServer));
          },
          onPlaybackRateChange: () => {
            if (applyingRemoteRef.current) return;
            const ws = wsRef.current;
            const p = playerRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN || !p) return;
            const rate = Number(p.getPlaybackRate?.() || 1);
            const t = Number(p.getCurrentTime?.() || 0);
            ws.send(JSON.stringify({ type: "setRate", roomId, rate, at: t } satisfies ClientToServer));
          },
        },
      });
    })().catch((e) => setErr(e instanceof Error ? e.message : "Failed to init player"));

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [roomId]);

  // Apply newest server state to player (drift-correct).
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !state) return;
    if (state.version <= lastAppliedVersionRef.current) return;

    applyingRemoteRef.current = true;
    const endApply = () => {
      applyingRemoteRef.current = false;
      lastAppliedVersionRef.current = state.version;
    };

    (async () => {
      const now = Date.now();
      const expected = computeExpectedPosition(state, serverTimeMs, now);

      if (state.videoId) {
        const currentId = p.getVideoData?.()?.video_id;
        if (currentId !== state.videoId) {
          // If the room is supposed to be playing, load (not just cue) so it actually starts.
          // If paused, cue so the user sees the right video without forcing playback.
          if (state.paused) {
            p.cueVideoById?.({ videoId: state.videoId, startSeconds: Math.max(0, expected) });
          } else {
            p.loadVideoById?.({ videoId: state.videoId, startSeconds: Math.max(0, expected) });
          }
        }
      }

      // Playback rate
      const currentRate = Number(p.getPlaybackRate?.() || 1);
      if (Math.abs(currentRate - state.playbackRate) > 0.01) {
        p.setPlaybackRate?.(state.playbackRate);
      }

      // Position correction
      const cur = Number(p.getCurrentTime?.() || 0);
      if (Number.isFinite(expected) && Math.abs(cur - expected) > 0.75) {
        p.seekTo?.(expected, true);
      }

      // Play/pause
      if (state.paused) {
        p.pauseVideo?.();
      } else {
        if (autoplayAssist) p.mute?.();
        p.playVideo?.();
        // If browser blocks autoplay, player often stays paused. Show a clear “click to start” affordance.
        window.setTimeout(() => {
          try {
            const ytState = p.getPlayerState?.();
            if (ytState !== 1) setNeedsClickToPlay(true);
          } catch {
            // ignore
          }
        }, 600);
      }
    })()
      .catch(() => {
        // ignore; typically player not ready yet
      })
      .finally(endApply);
  }, [state, serverTimeMs]);

  // Keep room warm + drift correction.
  useEffect(() => {
    const t = window.setInterval(() => {
      const ws = wsRef.current;
      const p = playerRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const at = p?.getCurrentTime?.();
      ws.send(JSON.stringify({ type: "ping", roomId, at: typeof at === "number" ? at : undefined } satisfies ClientToServer));
    }, 3000);
    return () => window.clearInterval(t);
  }, [roomId]);

  const send = (msg: ClientToServer) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(msg));
  };

  const playerTime = () => Number(playerRef.current?.getCurrentTime?.() || 0);

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
            <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Room</h1>
            <span style={{ color: "#9eb4e8", fontSize: "0.95rem" }}>
              <strong style={{ color: "#dde8ff" }}>{roomId}</strong> · {wsStatus}
            </span>
          </div>
          <div style={{ marginTop: "0.35rem", color: "#b8c9f0", fontSize: "0.95rem" }}>
            Invite:{" "}
            <a href={inviteUrl} style={{ color: "#9fbeff" }}>
              {inviteUrl}
            </a>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{
              padding: "0.55rem 0.7rem",
              borderRadius: 10,
              border: "1px solid #2f4478",
              background: "rgba(8, 12, 24, 0.35)",
              color: "#edf2ff",
              width: 180,
            }}
          />
          <button
            onClick={() => goto("/")}
            style={{
              padding: "0.55rem 0.8rem",
              borderRadius: 10,
              border: "1px solid #3d5a9e",
              background: "#142447",
              color: "#edf2ff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Leave
          </button>
        </div>
      </div>

      {err ? (
        <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.75rem", border: "1px solid #6b2a2a", borderRadius: 10, background: "rgba(80, 12, 12, 0.35)", color: "#ffb3b3" }}>
          {err}
        </div>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <div
          style={{
            borderRadius: 12,
            border: "1px solid #2f4478",
            background: "linear-gradient(180deg, #17264c 0%, #111b35 100%)",
            padding: "0.75rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={videoInput}
              onChange={(e) => setVideoInput(e.target.value)}
              placeholder="Paste YouTube URL or video id"
              style={{
                flex: "1 1 320px",
                padding: "0.6rem 0.75rem",
                borderRadius: 10,
                border: "1px solid #2f4478",
                background: "rgba(8, 12, 24, 0.35)",
                color: "#edf2ff",
              }}
            />
            <button
              onClick={() => {
                const id = parseYouTubeVideoId(videoInput);
                if (!id) {
                  setErr("Couldn’t parse a YouTube video id.");
                  return;
                }
                setErr(null);
                send({ type: "setVideo", roomId, videoId: id, at: 0 });
              }}
              style={{
                padding: "0.6rem 0.9rem",
                borderRadius: 10,
                border: "1px solid #3d5a9e",
                background: "#1b2e5d",
                color: "#edf2ff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Load for everyone
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={() => send({ type: "play", roomId, at: playerTime() })}
              style={{
                padding: "0.55rem 0.8rem",
                borderRadius: 10,
                border: "1px solid #3d5a9e",
                background: "#142447",
                color: "#edf2ff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Play
            </button>
            <button
              onClick={() => send({ type: "pause", roomId, at: playerTime() })}
              style={{
                padding: "0.55rem 0.8rem",
                borderRadius: 10,
                border: "1px solid #3d5a9e",
                background: "#142447",
                color: "#edf2ff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Pause
            </button>
            <button
              onClick={() => {
                const at = Math.max(0, playerTime() - 10);
                send({ type: "seek", roomId, at });
              }}
              style={{
                padding: "0.55rem 0.8rem",
                borderRadius: 10,
                border: "1px solid #3d5a9e",
                background: "#142447",
                color: "#edf2ff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              -10s
            </button>
            <button
              onClick={() => {
                const at = playerTime() + 10;
                send({ type: "seek", roomId, at });
              }}
              style={{
                padding: "0.55rem 0.8rem",
                borderRadius: 10,
                border: "1px solid #3d5a9e",
                background: "#142447",
                color: "#edf2ff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              +10s
            </button>
            <select
              onChange={(e) => send({ type: "setRate", roomId, rate: Number(e.target.value), at: playerTime() })}
              value={state?.playbackRate ?? 1}
              style={{
                padding: "0.55rem 0.7rem",
                borderRadius: 10,
                border: "1px solid #2f4478",
                background: "rgba(8, 12, 24, 0.35)",
                color: "#edf2ff",
                fontWeight: 700,
              }}
              title="Playback rate (synced)"
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                <option key={r} value={r}>
                  {r}x
                </option>
              ))}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#b8c9f0", fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={autoplayAssist}
                onChange={(e) => setAutoplayAssist(e.target.checked)}
              />
              autoplay assist (mute)
            </label>
          </div>

          <div style={{ marginTop: "0.75rem", borderRadius: 12, overflow: "hidden", border: "1px solid #2f4478", position: "relative" }}>
            <div id="yt-player" />
            {needsClickToPlay ? (
              <button
                onClick={() => {
                  const p = playerRef.current;
                  if (!p) return;
                  setNeedsClickToPlay(false);
                  try {
                    if (autoplayAssist) p.mute?.();
                    p.playVideo?.();
                  } catch {
                    // ignore
                  }
                }}
                style={{
                  position: "absolute",
                  inset: 12,
                  borderRadius: 12,
                  border: "1px solid #3d5a9e",
                  background: "rgba(20, 36, 71, 0.78)",
                  color: "#edf2ff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
                title="Some browsers require a click before media can play. Click once to start."
              >
                Click to start playback
              </button>
            ) : null}
          </div>

          <div style={{ marginTop: "0.65rem", color: "#9eb4e8", fontSize: "0.9rem" }}>
            {state?.videoId ? (
              <span>
                Video: <code style={{ color: "#c8d6ff" }}>{state.videoId}</code> · {state.paused ? "paused" : "playing"} · v
                {state.version}
              </span>
            ) : (
              <span>Load a YouTube video to start.</span>
            )}
          </div>
        </div>

        <aside
          style={{
            borderRadius: 12,
            border: "1px solid #2f4478",
            background: "linear-gradient(180deg, #17264c 0%, #111b35 100%)",
            padding: "0.75rem",
          }}
        >
          <div style={{ fontWeight: 800, color: "#dde8ff" }}>People ({users.length})</div>
          <div style={{ marginTop: "0.6rem", display: "grid", gap: "0.45rem" }}>
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  padding: "0.5rem 0.6rem",
                  borderRadius: 10,
                  border: "1px solid #2f4478",
                  background: "rgba(8, 12, 24, 0.28)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.6rem",
                }}
                title={new Date(u.joinedAt).toLocaleString()}
              >
                <span style={{ color: "#edf2ff", fontWeight: 700 }}>{u.name}</span>
                <span style={{ color: "#9eb4e8", fontSize: "0.85rem" }}>{u.id === selfId ? "you" : ""}</span>
              </div>
            ))}
            {users.length === 0 ? <div style={{ color: "#9eb4e8" }}>No one yet.</div> : null}
          </div>

          <div style={{ marginTop: "0.9rem", color: "#9eb4e8", fontSize: "0.92rem", lineHeight: 1.35 }}>
            <div style={{ fontWeight: 800, color: "#dde8ff" }}>Notes</div>
            <ul style={{ marginTop: "0.5rem" }}>
              <li>Rooms are ephemeral (in-memory). If the server restarts, rooms reset.</li>
              <li>Any user can control the room; the latest action wins.</li>
              <li>If someone drifts, they’ll auto-seek when the difference exceeds ~0.75s.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}

