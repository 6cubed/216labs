import OpenAI from "openai";
import Database from "better-sqlite3";
import fs from "fs";

const ADMIN_DB_PATH = "/app/216labs.db";

/** Read the key live from the shared admin DB so changes take effect instantly. */
function getApiKey(overrideKey?: string): string {
  if (overrideKey) return overrideKey;

  if (fs.existsSync(ADMIN_DB_PATH)) {
    try {
      const db = new Database(ADMIN_DB_PATH, { readonly: true, fileMustExist: true });
      const row = db.prepare(
        "SELECT value FROM env_vars WHERE key = 'MUINTEOIR_OPENAI_API_KEY' LIMIT 1"
      ).get() as { value: string } | undefined;
      db.close();
      if (row?.value) return row.value;
    } catch {
      // fall through to env var
    }
  }

  const key = process.env.MUINTEOIR_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (!key) throw new Error("No OpenAI API key configured. Set MUINTEOIR_OPENAI_API_KEY in the admin panel.");
  return key;
}

function getClient(apiKey?: string): OpenAI {
  return new OpenAI({ apiKey: getApiKey(apiKey) });
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Returns a ReadableStream of text chunks from GPT-4o.
 * The caller (API route) pipes this directly to the HTTP response.
 */
export async function streamChat(
  messages: ChatMessage[],
  apiKey?: string
): Promise<ReadableStream<Uint8Array>> {
  const client = getClient(apiKey);

  const stream = await client.chat.completions.create({
    model: "gpt-4o",
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 1500,
  });

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      stream.controller.abort();
    },
  });
}
