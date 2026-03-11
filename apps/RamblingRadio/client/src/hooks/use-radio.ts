import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateSessionRequest, type FeedbackRequest } from "@shared/routes";

// Create a new radio session
export function useCreateSession() {
  return useMutation({
    mutationFn: async (data: CreateSessionRequest) => {
      const res = await fetch(api.sessions.create.path, {
        method: api.sessions.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) throw new Error("Failed to start radio session");
      return await res.json();
    },
  });
}

// Fetch the next chunk of text content
export function useNextContent() {
  return useMutation({
    mutationFn: async (sessionId: number) => {
      const url = buildUrl(api.sessions.next.path, { id: sessionId });
      const res = await fetch(url, {
        method: api.sessions.next.method,
      });

      if (!res.ok) throw new Error("Failed to fetch next content");
      return await res.json() as { logId: number; content: string };
    },
  });
}

// Send feedback (thumbs up/down)
export function useFeedback() {
  return useMutation({
    mutationFn: async ({ sessionId, ...data }: { sessionId: number } & FeedbackRequest) => {
      const url = buildUrl(api.sessions.feedback.path, { id: sessionId });
      const res = await fetch(url, {
        method: api.sessions.feedback.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to submit feedback");
      return await res.json();
    },
  });
}

// Generate TTS audio from text
export function useTTS() {
  return useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(api.tts.generate.path, {
        method: api.tts.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("Failed to generate speech");
      
      // Get the binary data as a blob
      return await res.blob();
    },
  });
}
