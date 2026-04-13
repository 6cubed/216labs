import type { ChatMessage } from "./types";

const INDEX_KEY = "llmsearchapp_local_index";
const sessionKey = (id: string) => `llmsearchapp_local_${id}`;

export type LocalSessionMeta = { id: string; title: string; updatedAt: string };

export type LocalSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

export function listLocalSessions(): LocalSessionMeta[] {
  const ids = readIndex();
  const out: LocalSessionMeta[] = [];
  for (const id of ids) {
    try {
      const raw = localStorage.getItem(sessionKey(id));
      if (!raw) continue;
      const s = JSON.parse(raw) as LocalSession;
      out.push({
        id: s.id,
        title: s.title || "Chat",
        updatedAt: s.updatedAt,
      });
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function loadLocalSession(id: string): LocalSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as LocalSession;
  } catch {
    return null;
  }
}

export function saveLocalSession(session: LocalSession): void {
  const ids = readIndex();
  if (!ids.includes(session.id)) {
    writeIndex([session.id, ...ids]);
  }
  localStorage.setItem(sessionKey(session.id), JSON.stringify(session));
}

export function deleteLocalSession(id: string): void {
  localStorage.removeItem(sessionKey(id));
  writeIndex(readIndex().filter((x) => x !== id));
}

export function deriveLocalTitle(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= 56) return t || "New chat";
  return `${t.slice(0, 53)}…`;
}
