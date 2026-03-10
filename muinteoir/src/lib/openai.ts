import OpenAI from "openai";

function getClient(apiKey?: string): OpenAI {
  const key = apiKey ?? process.env.MUINTEOIR_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error("No OpenAI API key configured.");
  return new OpenAI({ apiKey: key });
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
