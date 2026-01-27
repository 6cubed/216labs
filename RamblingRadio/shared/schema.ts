import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  seedInterests: text("seed_interests").notNull(),
  context: text("context").notNull(), // Stores the evolving context/history
  createdAt: timestamp("created_at").defaultNow(),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  content: text("content").notNull(),
  feedback: text("feedback"), // 'up' | 'down' | null
  createdAt: timestamp("created_at").defaultNow(),
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
