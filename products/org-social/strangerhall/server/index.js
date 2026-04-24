/**
 * Stranger Hall — topic-queue stranger text chat (MVP).
 * In-memory only; restart clears queues. No logs of message bodies.
 */
import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3050, 10);
const MAX_MSG = Math.min(
  8000,
  Math.max(200, Number(process.env.STRANGERHALL_MAX_MSG_CHARS || 2000, 10) || 2000),
);
const MSG_PER_MINUTE = Math.min(
  200,
  Math.max(10, Number(process.env.STRANGERHALL_MSG_PER_MINUTE || 40, 10) || 40),
);

const TOPICS = new Set([
  "random",
  "art",
  "coding",
  "games",
  "music",
  "movies",
  "books",
  "sports",
  "life",
]);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));

const queues = new Map(); // topic -> ClientState[]
const clients = new Map(); // WebSocket -> ClientState
const reports = [];
const REPORT_CAP = 300;

/** @typedef {{ ws: import('ws').WebSocket, topic: string, peer: ClientState | null, roomId: string | null }} ClientState */

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

const rateBuckets = new Map(); // ip -> { t0, n }

function allowMessage(ip) {
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b || now - b.t0 > 60_000) {
    b = { t0: now, n: 0 };
    rateBuckets.set(ip, b);
  }
  if (b.n >= MSG_PER_MINUTE) return false;
  b.n += 1;
  return true;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function dequeue(client) {
  const q = queues.get(client.topic);
  if (!q) return;
  const i = q.indexOf(client);
  if (i >= 0) q.splice(i, 1);
}

function tryPair(topic) {
  const q = queues.get(topic);
  if (!q || q.length < 2) return;
  const alive = q.filter((c) => c.ws.readyState === 1);
  queues.set(topic, alive);
  while (alive.length >= 2) {
    const a = alive.shift();
    const b = alive.shift();
    if (!a || !b) break;
    const roomId = crypto.randomUUID();
    a.peer = b;
    b.peer = a;
    a.roomId = roomId;
    b.roomId = roomId;
    send(a.ws, { type: "matched", roomId, topic });
    send(b.ws, { type: "matched", roomId, topic });
  }
}

function joinQueue(client) {
  const topic = client.topic;
  if (!queues.has(topic)) queues.set(topic, []);
  const q = queues.get(topic);
  q.push(client);
  tryPair(topic);
}

function breakPair(client, reason) {
  const peer = client.peer;
  client.peer = null;
  client.roomId = null;
  if (peer) {
    peer.peer = null;
    peer.roomId = null;
    send(peer.ws, { type: "peer_left", reason });
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "strangerhall" });
});

app.get("/api/stats", (_req, res) => {
  let waiting = 0;
  for (const q of queues.values()) waiting += q.length;
  const rooms = [...clients.values()].filter((c) => c.roomId && c.peer).length / 2;
  res.json({
    waiting: Math.floor(waiting),
    connected: clients.size,
    rooms: Math.floor(rooms),
  });
});

app.post("/api/report", (req, res) => {
  const { reason, topic } = req.body || {};
  const ip = clientIp(req);
  const entry = {
    at: new Date().toISOString(),
    ip,
    topic: typeof topic === "string" ? topic.slice(0, 64) : "",
    reason: typeof reason === "string" ? reason.slice(0, 500) : "",
  };
  reports.push(entry);
  if (reports.length > REPORT_CAP) reports.splice(0, reports.length - REPORT_CAP);
  res.status(204).end();
});

app.use(express.static(path.join(__dirname, "../public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const ip = clientIp(req);
  /** @type {ClientState} */
  const state = { ws, topic: "random", peer: null, roomId: null };
  clients.set(ws, state);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "join") {
      dequeue(state);
      breakPair(state, "rejoin");
      const t = typeof msg.topic === "string" ? msg.topic.toLowerCase().trim() : "random";
      state.topic = TOPICS.has(t) ? t : "random";
      joinQueue(state);
      send(ws, { type: "queued", topic: state.topic });
      return;
    }

    if (msg.type === "skip") {
      dequeue(state);
      breakPair(state, "skip");
      joinQueue(state);
      send(ws, { type: "queued", topic: state.topic });
      return;
    }

    if (msg.type === "chat") {
      if (!state.peer || !state.roomId) return;
      if (!allowMessage(ip)) {
        send(ws, { type: "error", message: "Rate limit — slow down." });
        return;
      }
      const text = typeof msg.text === "string" ? msg.text : "";
      const clipped = text.slice(0, MAX_MSG);
      if (!clipped.trim()) return;
      send(state.peer.ws, { type: "chat", text: clipped });
      return;
    }
  });

  ws.on("close", () => {
    dequeue(state);
    breakPair(state, "disconnect");
    clients.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`strangerhall listening on ${PORT}`);
});
