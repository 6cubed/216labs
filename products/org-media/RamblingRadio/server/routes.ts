import type { Express, NextFunction, Request, Response } from "express";
import { createServer, type Server } from "http";
import { AppError } from "@216labs/errors";
import { db } from "./db";
import { sessions, logs } from "@shared/schema";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { eq } from "drizzle-orm";
import { textToSpeech } from "./replit_integrations/audio/client";

const ai = {
  models: {
    generateContent: () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify([
                  "Welcome to Rambling Radio!",
                  "Today, we'll be discussing fascinating topics.",
                  "Stay tuned for an endless stream of engaging content.",
                ]),
              },
            ],
          },
        },
      ],
    }),
  },
} as any;

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.post(
    api.sessions.create.path,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { seedInterests } = api.sessions.create.input.parse(req.body);
        const initialContext = `The listener is interested in: ${seedInterests}. You are a knowledgeable, engaging radio host. Start talking about these topics. Keep it flowy, natural, and interesting.`;

        const session = await storage.createSession({
          seedInterests,
          context: initialContext,
        });

        res.status(201).json(session);
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    api.sessions.next.path,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = Number(req.params.id);
        const session = await storage.getSession(sessionId);
        const { count = 5 } = req.body || {};

        if (!session) {
          return next(
            AppError.notFound("SESSION_NOT_FOUND", "Session not found"),
          );
        }

        const prompt = `
        Context: ${session.context}
        
        Task: Generate the next segment of the monologue. 
        - Generate EXACTLY ${count} sentences.
        - Each sentence should be reasonably long (15-25 words) to ensure continuous speech.
        - Return them as a JSON array of strings: ["sentence 1", "sentence 2", ...]
        - Be engaging, go down rabbit holes based on the context.
        - Do not repeat yourself.
        - Don't start with "Okay" or "Sure". Just continue the flow.
        - This is a continuous stream of thought.
      `;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
          },
        });

        const rawContent =
          response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        let sentences: string[] = [];
        try {
          sentences = JSON.parse(rawContent);
          if (!Array.isArray(sentences)) sentences = [rawContent];
        } catch {
          sentences = [rawContent];
        }

        const results = [];
        let updatedContext = session.context;

        for (const content of sentences) {
          updatedContext += "\nHost: " + content;

          const log = await storage.createLog({
            sessionId,
            content,
            feedback: null,
          });
          results.push({ logId: log.id, content });
        }

        if (updatedContext.length > 5000) {
          updatedContext = updatedContext.slice(-4000);
        }

        await storage.updateSessionContext(sessionId, updatedContext);

        res.json({ sentences: results });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    api.sessions.feedback.path,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = Number(req.params.id);
        const { logId, feedback } = api.sessions.feedback.input.parse(req.body);

        await storage.updateLogFeedback(logId, feedback);

        const session = await storage.getSession(sessionId);
        if (session) {
          const logContent =
            (
              await db.query.logs.findFirst({
                where: (logs, { eq }) => eq(logs.id, logId),
              })
            )?.content || "";

          let feedbackNote = "";
          if (feedback === "up") {
            feedbackNote = `\n[System Note: User LIKED the last segment about "${logContent.slice(0, 50)}...". Go deeper into this topic/style.]`;
          } else {
            feedbackNote = `\n[System Note: User DISLIKED the last segment about "${logContent.slice(0, 50)}...". Change topic immediately and avoid this style.]`;
          }

          let newContext = session.context + feedbackNote;
          if (newContext.length > 5000) newContext = newContext.slice(-4000);

          await storage.updateSessionContext(sessionId, newContext);
        }

        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    api.tts.generate.path,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { text } = api.tts.generate.input.parse(req.body);

        const audioBuffer = await textToSpeech(text, "onyx");

        res.set({
          "Content-Type": "audio/mpeg",
          "Content-Length": audioBuffer.length,
        });
        res.send(audioBuffer);
      } catch (err) {
        next(err);
      }
    },
  );

  return httpServer;
}
