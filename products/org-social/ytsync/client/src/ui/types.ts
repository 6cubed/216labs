export type Presence = {
  id: string;
  name: string;
  joinedAt: number;
  lastSeenAt: number;
};

export type RoomState = {
  videoId: string | null;
  playbackRate: number;
  paused: boolean;
  position: number;
  updatedAt: number;
  version: number;
};

export type ServerToClient =
  | { type: "hello"; selfId: string; serverTime: number }
  | { type: "state"; roomId: string; state: RoomState; serverTime: number }
  | { type: "presence"; roomId: string; users: Presence[]; serverTime: number }
  | { type: "error"; message: string };

export type ClientToServer =
  | { type: "join"; roomId: string; name?: string }
  | { type: "setVideo"; roomId: string; videoId: string; at?: number }
  | { type: "play"; roomId: string; at: number }
  | { type: "pause"; roomId: string; at: number }
  | { type: "seek"; roomId: string; at: number }
  | { type: "setRate"; roomId: string; rate: number; at: number }
  | { type: "ping"; roomId: string; at?: number };

