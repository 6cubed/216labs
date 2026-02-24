import OpenAI from "openai";

export interface ModelConfig {
  id: string;
  name: string;
  params: string;
  provider: string;
  color: string;
}

export const MODELS: ModelConfig[] = [
  {
    id: "qwen/qwen-2.5-0.5b-instruct",
    name: "Qwen 2.5 0.5B",
    params: "0.5B",
    provider: "Alibaba",
    color: "#6366f1",
  },
  {
    id: "meta-llama/llama-3.2-1b-instruct",
    name: "Llama 3.2 1B",
    params: "1B",
    provider: "Meta",
    color: "#8b5cf6",
  },
  {
    id: "google/gemma-2-2b-it",
    name: "Gemma 2 2B",
    params: "2B",
    provider: "Google",
    color: "#a78bfa",
  },
  {
    id: "meta-llama/llama-3.2-3b-instruct",
    name: "Llama 3.2 3B",
    params: "3B",
    provider: "Meta",
    color: "#3b82f6",
  },
  {
    id: "mistralai/mistral-7b-instruct",
    name: "Mistral 7B",
    params: "7B",
    provider: "Mistral AI",
    color: "#06b6d4",
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B",
    params: "8B",
    provider: "Meta",
    color: "#10b981",
  },
  {
    id: "google/gemma-2-9b-it",
    name: "Gemma 2 9B",
    params: "9B",
    provider: "Google",
    color: "#84cc16",
  },
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B",
    params: "70B",
    provider: "Meta",
    color: "#eab308",
  },
  {
    id: "anthropic/claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    params: "~20B",
    provider: "Anthropic",
    color: "#f97316",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    params: "~8B",
    provider: "OpenAI",
    color: "#ef4444",
  },
];

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.CALIBRATEDAI_OPENROUTER_API_KEY || "",
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://216labs.com",
        "X-Title": "CalibratedAI",
      },
    });
  }
  return _client;
}

export async function getModelEstimate(
  modelId: string,
  question: string,
  description: string
): Promise<number | null> {
  const openai = getClient();

  const prompt = `You are a calibrated probability forecaster. Your task is to estimate the probability that the following prediction market question resolves YES.

Question: ${question}
${description ? `\nContext: ${description.slice(0, 500)}` : ""}

Respond with ONLY a single decimal number between 0 and 1 (e.g. 0.75). No other text, no explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 15,
      temperature: 0,
    });

    const text = response.choices[0]?.message?.content?.trim() || "";

    const direct = parseFloat(text);
    if (!isNaN(direct) && direct >= 0 && direct <= 1) return direct;

    // Extract first number from response
    const match = text.match(/\b(0?\.\d+|\d+\.?\d*)\b/);
    if (match) {
      const extracted = parseFloat(match[1]);
      if (extracted >= 0 && extracted <= 1) return extracted;
      if (extracted > 1 && extracted <= 100) return extracted / 100;
    }

    console.warn(`[${modelId}] Could not parse probability from: "${text}"`);
    return null;
  } catch (error) {
    console.error(
      `[${modelId}] Error:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
