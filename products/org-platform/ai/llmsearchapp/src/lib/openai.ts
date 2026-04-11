import OpenAI from "openai";

export function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it in admin Environment (droplet) or .env for local dev."
    );
  }
  return new OpenAI({ apiKey: key });
}

export function chatModel(): string {
  return process.env.LLMSEARCH_MODEL?.trim() || "gpt-4o-mini";
}
