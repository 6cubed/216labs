import express from "express";
import path from "path";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { createRoomId, RoomStore, applyPlayPause, applyRate, applySeek, applyVideo, computePositionNow } from "./rooms";
import type { ClientToServer, Presence, ServerToClient } from "./protocol";
import { nanoid } from "nanoid";

const PORT = parseInt(process.env.PORT || "5000", 10);
const store = new RoomStore();

function nowMs() {
  return Date.now();
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function send(ws: import("ws").WebSocket, msg: ServerToClient) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function broadcast(roomId: string, msg: ServerToClient) {
  for (const client of wss.clients) {
    const meta = wsMeta.get(client);
    if (!meta || meta.roomId !== roomId) continue;
    send(client, msg);
  }
}

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/api/rooms", (_req, res) => {
  const roomId = createRoomId();
  store.getOrCreate(roomId);
  res.json({ roomId });
});

const httpServer = createServer(app);

// WebSocket: single endpoint for all rooms.
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

type WsMeta = {
  selfId: string;
  roomId: string | null;
  name: string;
};

const wsMeta = new WeakMap<import("ws").WebSocket, WsMeta>();

function roomUsers(roomId: string): Presence[] {
  const room = store.get(roomId);
  if (!room) return [];
  return [...room.users.values()].sort((a, b) => a.joinedAt - b.joinedAt);
}

wss.on("connection", (ws) => {
  const selfId = nanoid(10);
  wsMeta.set(ws, { selfId, roomId: null, name: "Guest" });
  send(ws, { type: "hello", selfId, serverTime: nowMs() });

  ws.on("message", (raw) => {
    const text = typeof raw === "string" ? raw : raw.toString("utf-8");
    const parsed = safeJsonParse(text);
    if (!parsed || typeof parsed !== "object") {
      send(ws, { type: "error", message: "Invalid message" });
      return;
    }

    const msg = parsed as ClientToServer;
    const meta = wsMeta.get(ws);
    if (!meta) return;

    if (msg.type === "join") {
      const roomId = (msg.roomId || "").trim();
      if (!roomId) {
        send(ws, { type: "error", message: "Missing roomId" });
        return;
      }
      meta.roomId = roomId;
      meta.name = (msg.name || "Guest").slice(0, 40).trim() || "Guest";

      const room = store.getOrCreate(roomId);
      const t = nowMs();
      room.users.set(meta.selfId, {
        id: meta.selfId,
        name: meta.name,
        joinedAt: t,
        lastSeenAt: t,
      });

      broadcast(roomId, { type: "presence", roomId, users: roomUsers(roomId), serverTime: t });
      broadcast(roomId, { type: "state", roomId, state: room.state, serverTime: t });
      return;
    }

    const roomId = msg.roomId?.trim();
    if (!roomId) {
      send(ws, { type: "error", message: "Missing roomId" });
      return;
    }
    const room = store.get(roomId);
    if (!room) {
      // If someone tries to control before join, create room and let them.
      store.getOrCreate(roomId);
    }

    const room2 = store.getOrCreate(roomId);
    const t = nowMs();
    const user = room2.users.get(meta.selfId);
    if (user) {
      user.lastSeenAt = t;
      user.name = meta.name;
    }

    switch (msg.type) {
      case "setVideo": {
        const videoId = (msg.videoId || "").trim();
        if (!videoId) return;
        room2.state = applyVideo(room2.state, videoId, msg.at ?? 0, t);
        room2.state = applyPlayPause(room2.state, true, msg.at ?? 0, t);
        broadcast(roomId, { type: "state", roomId, state: room2.state, serverTime: t });
        break;
      }
      case "play": {
        room2.state = applyPlayPause(room2.state, false, msg.at ?? computePositionNow(room2.state, t), t);
        broadcast(roomId, { type: "state", roomId, state: room2.state, serverTime: t });
        break;
      }
      case "pause": {
        room2.state = applyPlayPause(room2.state, true, msg.at ?? computePositionNow(room2.state, t), t);
        broadcast(roomId, { type: "state", roomId, state: room2.state, serverTime: t });
        break;
      }
      case "seek": {
        room2.state = applySeek(room2.state, msg.at ?? 0, t);
        broadcast(roomId, { type: "state", roomId, state: room2.state, serverTime: t });
        break;
      }
      case "setRate": {
        room2.state = applyRate(room2.state, msg.rate, msg.at ?? computePositionNow(room2.state, t), t);
        broadcast(roomId, { type: "state", roomId, state: room2.state, serverTime: t });
        break;
      }
      case "ping": {
        // Lightweight: echo state (helps late joiners + drift correction).
        broadcast(roomId, { type: "presence", roomId, users: roomUsers(roomId), serverTime: t });
        send(ws, { type: "state", roomId, state: room2.state, serverTime: t });
        break;
      }
      default: {
        // no-op
        break;
      }
    }
  });

  ws.on("close", () => {
    const meta = wsMeta.get(ws);
    if (!meta?.roomId) return;
    const room = store.get(meta.roomId);
    if (!room) return;
    room.users.delete(meta.selfId);
    broadcast(meta.roomId, { type: "presence", roomId: meta.roomId, users: roomUsers(meta.roomId), serverTime: nowMs() });
  });
});

if (process.env.NODE_ENV === "production") {
  // In Docker, we run from /app and copy `dist/` to /app/dist.
  const publicDir = path.resolve(process.cwd(), "dist/public");
  app.use(express.static(publicDir));
  app.use("/{*splat}", (_req, res) => {
    res.sendFile(path.resolve(publicDir, "index.html"));
  });
} else {
  // Dev: run `npm run dev` and open Vite separately if desired.
}

httpServer.listen({ port: PORT, host: "0.0.0.0", reusePort: true }, () => {
  console.log(`[ytsync] listening on http://0.0.0.0:${PORT}`);
});

