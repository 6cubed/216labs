import { nanoid } from "nanoid";
import type { Presence, RoomState } from "./protocol";

type Room = {
  id: string;
  state: RoomState;
  users: Map<string, Presence>;
  updatedAt: number;
};

export function createRoomId(): string {
  // Shareable, case-sensitive but avoids confusing chars by default? nanoid is ok for MVP.
  return nanoid(10);
}

function nowMs() {
  return Date.now();
}

export class RoomStore {
  private rooms = new Map<string, Room>();

  constructor(private readonly maxIdleMs = 6 * 60 * 60 * 1000) {
    setInterval(() => this.gc(), 60 * 1000).unref?.();
  }

  getOrCreate(roomId: string): Room {
    const existing = this.rooms.get(roomId);
    if (existing) {
      existing.updatedAt = nowMs();
      return existing;
    }

    const state: RoomState = {
      videoId: null,
      playbackRate: 1,
      paused: true,
      position: 0,
      updatedAt: nowMs(),
      version: 1,
    };

    const room: Room = {
      id: roomId,
      state,
      users: new Map(),
      updatedAt: nowMs(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  get(roomId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    room.updatedAt = nowMs();
    return room;
  }

  touch(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) room.updatedAt = nowMs();
  }

  delete(roomId: string) {
    this.rooms.delete(roomId);
  }

  gc() {
    const t = nowMs();
    for (const [id, room] of this.rooms) {
      if (t - room.updatedAt > this.maxIdleMs) this.rooms.delete(id);
    }
  }
}

export function computePositionNow(state: RoomState, serverNow = nowMs()): number {
  if (state.paused) return state.position;
  const dt = Math.max(0, serverNow - state.updatedAt) / 1000;
  return state.position + dt * state.playbackRate;
}

export function applySeek(state: RoomState, atSeconds: number, serverNow = nowMs()): RoomState {
  return {
    ...state,
    position: Math.max(0, atSeconds),
    updatedAt: serverNow,
    version: state.version + 1,
  };
}

export function applyPlayPause(
  state: RoomState,
  paused: boolean,
  atSeconds: number,
  serverNow = nowMs(),
): RoomState {
  return {
    ...state,
    paused,
    position: Math.max(0, atSeconds),
    updatedAt: serverNow,
    version: state.version + 1,
  };
}

export function applyRate(state: RoomState, rate: number, atSeconds: number, serverNow = nowMs()): RoomState {
  const r = Number.isFinite(rate) ? Math.min(2, Math.max(0.25, rate)) : 1;
  return {
    ...state,
    playbackRate: r,
    position: Math.max(0, atSeconds),
    updatedAt: serverNow,
    version: state.version + 1,
  };
}

export function applyVideo(state: RoomState, videoId: string, atSeconds: number, serverNow = nowMs()): RoomState {
  return {
    ...state,
    videoId,
    position: Math.max(0, atSeconds),
    updatedAt: serverNow,
    version: state.version + 1,
  };
}

