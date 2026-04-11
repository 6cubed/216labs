import fs from "fs/promises";
import path from "path";
import type { ChatMessage, Session } from "./types";

function dataDir(): string {
  return process.env.LLMSEARCH_DATA_DIR?.trim() || path.join(process.cwd(), "data");
}

function sessionsDir(): string {
  return path.join(dataDir(), "sessions");
}

function fileFor(id: string): string {
  return path.join(sessionsDir(), `${id}.json`);
}

export async function ensureDataDir(): Promise<void> {
  await fs.mkdir(sessionsDir(), { recursive: true });
}

export async function readSession(id: string): Promise<Session | null> {
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function writeSession(session: Session): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(fileFor(session.id), JSON.stringify(session, null, 2), "utf8");
}

export async function listSessionsMeta(): Promise<Array<{ id: string; title: string; updatedAt: string }>> {
  await ensureDataDir();
  let names: string[];
  try {
    names = await fs.readdir(sessionsDir());
  } catch {
    return [];
  }
  const jsonFiles = names.filter((n) => n.endsWith(".json"));
  const out: Array<{ id: string; title: string; updatedAt: string }> = [];
  for (const f of jsonFiles) {
    const id = f.replace(/\.json$/, "");
    const s = await readSession(id);
    if (s) {
      out.push({ id: s.id, title: s.title, updatedAt: s.updatedAt });
    }
  }
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return out;
}

export function newMessageId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function deriveTitleFromMessage(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= 56) return t || "New chat";
  return `${t.slice(0, 53)}…`;
}
