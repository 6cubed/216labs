import React, { useMemo, useState } from "react";

async function createRoom(): Promise<string> {
  const r = await fetch("/api/rooms", { method: "POST" });
  if (!r.ok) throw new Error("Failed to create room");
  const j = (await r.json()) as { roomId: string };
  return j.roomId;
}

function goto(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function Home() {
  const [joining, setJoining] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const shareBase = useMemo(() => `${window.location.origin}/r/`, []);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "2rem 1rem 3rem" }}>
      <h1 style={{ margin: 0, fontSize: "2rem" }}>YT Sync</h1>
      <p style={{ marginTop: "0.5rem", color: "#b8c9f0", maxWidth: 760 }}>
        Create a room, share the invite, and anyone in the group can play/pause/seek a YouTube embed for everyone.
      </p>

      <div
        style={{
          marginTop: "1.25rem",
          padding: "1rem",
          borderRadius: 12,
          border: "1px solid #2f4478",
          background: "linear-gradient(180deg, #17264c 0%, #111b35 100%)",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={async () => {
              setErr(null);
              setJoining(true);
              try {
                const id = await createRoom();
                goto(`/r/${id}`);
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Failed");
              } finally {
                setJoining(false);
              }
            }}
            disabled={joining}
            style={{
              padding: "0.6rem 0.9rem",
              borderRadius: 10,
              border: "1px solid #3d5a9e",
              background: "#142447",
              color: "#edf2ff",
              fontWeight: 700,
              cursor: joining ? "not-allowed" : "pointer",
            }}
          >
            Create room
          </button>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: "1 1 360px" }}>
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room id (or paste invite link)"
              style={{
                flex: 1,
                padding: "0.6rem 0.75rem",
                borderRadius: 10,
                border: "1px solid #2f4478",
                background: "rgba(8, 12, 24, 0.35)",
                color: "#edf2ff",
              }}
            />
            <button
              onClick={() => {
                setErr(null);
                const trimmed = roomId.trim();
                const m = trimmed.match(/\/r\/([A-Za-z0-9_-]{4,64})/);
                const id = (m?.[1] || trimmed).trim();
                if (!id) {
                  setErr("Enter a room id");
                  return;
                }
                goto(`/r/${id}`);
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
              Join
            </button>
          </div>
        </div>

        <p style={{ marginTop: "0.85rem", color: "#9eb4e8", fontSize: "0.92rem" }}>
          Tip: share invite links like <code style={{ color: "#c8d6ff" }}>{shareBase}ROOMID</code>.
        </p>
        {err ? <p style={{ marginTop: "0.5rem", color: "#ffb3b3" }}>{err}</p> : null}
      </div>

      <div style={{ marginTop: "1.25rem", color: "#9eb4e8", fontSize: "0.92rem", maxWidth: 900 }}>
        <div style={{ fontWeight: 700, color: "#dde8ff" }}>How sync works</div>
        <ul style={{ marginTop: "0.5rem" }}>
          <li>Any user action (load video / play / pause / seek) updates the room’s state on the server.</li>
          <li>All clients apply the newest state (last write wins) and auto-correct drift when needed.</li>
        </ul>
      </div>
    </main>
  );
}

