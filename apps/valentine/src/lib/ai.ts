import OpenAI from "openai";

function getClient(): OpenAI {
  const key = process.env.VALENTINE_OPENAI_API_KEY;
  if (!key) throw new Error("VALENTINE_OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

export interface GeneratedCardCopy {
  title: string;
  insideMessage: string;
  imagePrompt: string;
}

const SYSTEM = `You are a thoughtful greeting-card copywriter and art director for romantic Valentine's Day cards.

The user gives: a short idea, optional recipient name, and a tone (romantic, playful, poetic, or funny).

Produce:
1. "title" — a short, catchy cover line (max ~8 words) for the front of the card.
2. "insideMessage" — 2–5 sentences for the inside of the card. Warm and personal; use the recipient name naturally if provided.
3. "imagePrompt" — a detailed scene description for DALL-E to illustrate the *front* of the card (no text in the image). Match the tone. Specify mood, colours, and key visual elements. The image must be wholesome and suitable for all audiences.

Respond ONLY with valid JSON (no markdown):
{
  "title": "...",
  "insideMessage": "...",
  "imagePrompt": "..."
}`;

export async function generateCardCopy(
  idea: string,
  recipientName: string,
  tone: string
): Promise<GeneratedCardCopy> {
  const user = [
    `Idea: ${idea}`,
    recipientName ? `Recipient: ${recipientName}` : "Recipient: not specified",
    `Tone: ${tone}`,
  ].join("\n");

  const response = await getClient().chat.completions.create({
    model: "gpt-4o",
    temperature: 0.85,
    max_tokens: 2000,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as GeneratedCardCopy;

  if (!parsed.title || !parsed.insideMessage || !parsed.imagePrompt) {
    throw new Error("Card generation returned incomplete fields");
  }

  return parsed;
}

export async function generateCardImage(imagePrompt: string): Promise<string> {
  const fullPrompt = [
    `Elegant Valentine's Day greeting card front artwork, vertical card format feel.`,
    `Scene: ${imagePrompt}`,
    `Style: soft romantic illustration or painterly digital art, cohesive palette (roses, cream, gold accents allowed), high quality print design.`,
    `No text, letters, numbers, or watermarks in the image.`,
  ].join(" ");

  const response = await getClient().images.generate({
    model: "dall-e-3",
    prompt: fullPrompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
    style: "vivid",
    response_format: "url",
  });

  return response.data?.[0]?.url ?? "";
}
