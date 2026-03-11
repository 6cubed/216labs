import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = sqliteTable("sessions", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  seedInterests: text("seed_interests").notNull(),
  context: text("context").notNull(), // Stores the evolving context/history
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const logs = sqliteTable("logs", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id", { mode: 'number' }).notNull().references(() => sessions.id),
  content: text("content").notNull(),
  feedback: text("feedback"), // 'up' | 'down' | null
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true });
export const insertLogSchema = createInsertSchema(logs).omit({ id: true, createdAt: true });

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

// API Payloads
export type CreateSessionRequest = {
  seedInterests: string;
};

export type FeedbackRequest = {
  logId: number;
  feedback: 'up' | 'down';
};

export type NextContentResponse = {
  logId: number;
  content: string;
};

export type SentenceBufferResponse = {
  sentences: {
    logId: number;
    content: string;
  }[];
};
