import OpenAI from "openai";

const ADMIN_ENV_URL = "http://admin:3000/internal/env";

/**
 * Fetch the API key live from the admin service so changes in the admin panel
 * take effect on the next request — no redeploy required.
 * Falls back to process env for local development (where admin isn't running).
 */
async function getApiKey(overrideKey?: string): Promise<string> {
  if (overrideKey) return overrideKey;

  try {
    const res = await fetch(
      `${ADMIN_ENV_URL}?key=MUINTEOIR_OPENAI_API_KEY`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const { value } = await res.json();
      if (value) return value;
    }
  } catch {
    // admin not reachable — fall through to env var (local dev)
  }

  const key = process.env.MUINTEOIR_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (!key)
    throw new Error(
      "No OpenAI API key configured. Set OPENAI_API_KEY or MUINTEOIR_OPENAI_API_KEY in admin Env."
    );
  return key;
}

async function getClient(apiKey?: string): Promise<OpenAI> {
  return new OpenAI({ apiKey: await getApiKey(apiKey) });
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
  const client = await getClient(apiKey);

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
