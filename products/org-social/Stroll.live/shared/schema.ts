import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const segments = sqliteTable("segments", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  country: text("country").notNull(),
  minLat: real("min_lat").notNull(),
  maxLat: real("max_lat").notNull(),
  minLon: real("min_lon").notNull(),
  maxLon: real("max_lon").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`
  ),
});

export const content = sqliteTable("content", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  segmentId: integer("segment_id", { mode: "number" })
    .notNull()
    .references(() => segments.id),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
  body: text("body").notNull(),
  authorName: text("author_name").notNull().default("Anonymous"),
  authorHue: integer("author_hue", { mode: "number" }).notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`
  ),
});

export type Segment = typeof segments.$inferSelect;
export type Content = typeof content.$inferSelect;
