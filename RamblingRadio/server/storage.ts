import { db } from "./db";
import { sessions, logs, type Session, type InsertSession, type Log, type InsertLog } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: number): Promise<Session | undefined>;
  updateSessionContext(id: number, context: string): Promise<Session>;
  createLog(log: InsertLog): Promise<Log>;
  updateLogFeedback(id: number, feedback: 'up' | 'down'): Promise<Log>;
}

export class DatabaseStorage implements IStorage {
  async createSession(insertSession: InsertSession): Promise<Session> {
    const [session] = await db.insert(sessions).values(insertSession).returning();
    return session;
  }

  async getSession(id: number): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async updateSessionContext(id: number, context: string): Promise<Session> {
    const [session] = await db.update(sessions)
      .set({ context })
      .where(eq(sessions.id, id))
      .returning();
    return session;
  }

  async createLog(insertLog: InsertLog): Promise<Log> {
    const [log] = await db.insert(logs).values(insertLog).returning();
    return log;
  }

  async updateLogFeedback(id: number, feedback: 'up' | 'down'): Promise<Log> {
    const [log] = await db.update(logs)
      .set({ feedback })
      .where(eq(logs.id, id))
      .returning();
    return log;
  }
}

export const storage = new DatabaseStorage();
