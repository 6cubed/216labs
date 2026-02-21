import type { Express } from "express";
import { db } from "./db.js";
import { segments, content } from "@shared/schema";
import { and, gte, lte, desc, eq } from "drizzle-orm";
import { generateAuthor } from "./identity.js";

export function registerRoutes(app: Express) {
  // Find segment that contains the given point
  app.get("/api/segment", async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ error: "lat and lon required" });
    }
    const [segment] = await db
      .select()
      .from(segments)
      .where(
        and(
          lte(segments.minLat, lat),
          gte(segments.maxLat, lat),
          lte(segments.minLon, lon),
          gte(segments.maxLon, lon)
        )
      )
      .limit(1);
    if (!segment) {
      return res.status(404).json({ error: "No segment for this location" });
    }
    res.json(segment);
  });

  // Get segment by slug
  app.get("/api/segment/:slug", async (req, res) => {
    const [segment] = await db
      .select()
      .from(segments)
      .where(eq(segments.slug, req.params.slug))
      .limit(1);
    if (!segment) return res.status(404).json({ error: "Segment not found" });
    res.json(segment);
  });

  // Get segment by id (for feed page)
  app.get("/api/segments/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [segment] = await db.select().from(segments).where(eq(segments.id, id)).limit(1);
    if (!segment) return res.status(404).json({ error: "Segment not found" });
    res.json(segment);
  });

  // List all segments (admin)
  app.get("/api/admin/segments", async (_req, res) => {
    const list = await db.select().from(segments).orderBy(segments.name);
    res.json(list);
  });

  // Get recent content for a segment
  app.get("/api/segments/:id/content", async (req, res) => {
    const segmentId = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const list = await db
      .select()
      .from(content)
      .where(eq(content.segmentId, segmentId))
      .orderBy(desc(content.createdAt))
      .limit(limit);
    res.json(list);
  });

  // Submit new content (user provides lat, lon, body; we resolve segment)
  app.post("/api/content", async (req, res) => {
    const { lat, lon, body } = req.body;
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      typeof body !== "string" ||
      body.trim().length === 0
    ) {
      return res.status(400).json({ error: "lat, lon (numbers) and body (non-empty string) required" });
    }
    const [segment] = await db
      .select()
      .from(segments)
      .where(
        and(
          lte(segments.minLat, lat),
          gte(segments.maxLat, lat),
          lte(segments.minLon, lon),
          gte(segments.maxLon, lon)
        )
      )
      .limit(1);
    if (!segment) {
      return res.status(400).json({ error: "No segment for this location" });
    }
    const { authorName, authorHue } = generateAuthor(req);
    const [row] = await db
      .insert(content)
      .values({ segmentId: segment.id, lat, lon, body: body.trim(), authorName, authorHue })
      .returning();
    res.status(201).json(row);
  });
}
