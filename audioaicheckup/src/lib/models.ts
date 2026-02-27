import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export interface ModelConfig {
  id: string;
  name: string;
  provider: "openai" | "gemini";
  description: string;
}

export const MODELS: ModelConfig[] = [
  {
    id: "gpt-4o-audio-preview",
    name: "GPT-4o Audio",
    provider: "openai",
    description: "OpenAI GPT-4o with native audio understanding",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "gemini",
    description: "Google Gemini 2.0 Flash with native audio understanding",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "gemini",
    description: "Google Gemini 1.5 Pro with native audio understanding",
  },
];

export interface EvaluationResult {
  modelId: string;
  modelName: string;
  provider: string;
  rawAnswer: string | null;
  isCorrect: boolean;
  latencyMs: number;
  error: string | null;
}

const EVAL_PROMPT = (question: string) =>
  `Listen carefully to the audio recording. Then answer the following question:\n\n${question}\n\nIMPORTANT: Respond with ONLY your answer — no explanation, no reasoning, no extra words. Just the answer itself.`;

function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"-]+$/g, "")
    .replace(/^[.,!?;:'"-]+/g, "")
    .trim();
}

export function answersMatch(modelAnswer: string, expected: string): boolean {
  return normalizeAnswer(modelAnswer) === normalizeAnswer(expected);
}

function convertWebmToMp3(audioBuffer: Buffer): Buffer {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpIn = join(tmpdir(), `aac-in-${id}.webm`);
  const tmpOut = join(tmpdir(), `aac-out-${id}.mp3`);
  try {
    writeFileSync(tmpIn, audioBuffer);
    execSync(`ffmpeg -i "${tmpIn}" -b:a 32k "${tmpOut}" -y 2>/dev/null`, {
      timeout: 120_000,
    });
    return readFileSync(tmpOut);
  } finally {
    try { unlinkSync(tmpIn); } catch { /* ignore */ }
    try { unlinkSync(tmpOut); } catch { /* ignore */ }
  }
}

async function evaluateOpenAI(
  audioBuffer: Buffer,
  question: string
): Promise<string> {
  const apiKey = process.env.AUDIOAICHECKUP_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const mp3Buffer = convertWebmToMp3(audioBuffer);
  const base64Audio = mp3Buffer.toString("base64");

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: "gpt-4o-audio-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: { data: base64Audio, format: "mp3" },
          },
          { type: "text", text: EVAL_PROMPT(question) },
        ],
      },
    ],
    max_tokens: 150,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

async function evaluateGemini(
  audioBuffer: Buffer,
  mimeType: string,
  question: string,
  modelId: string
): Promise<string> {
  const apiKey = process.env.AUDIOAICHECKUP_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: modelId,
    generationConfig: { maxOutputTokens: 150, temperature: 0.1 },
  });

  const base64Audio = audioBuffer.toString("base64");
  const result = await model.generateContent([
    { text: EVAL_PROMPT(question) },
    { inlineData: { mimeType, data: base64Audio } },
  ]);

  const raw = result.response.text().trim();
  return raw.replace(/^```[\w]*\s*/m, "").replace(/\s*```\s*$/m, "").trim();
}

export async function evaluateWithModel(
  audioBuffer: Buffer,
  mimeType: string,
  question: string,
  expectedAnswer: string,
  model: ModelConfig
): Promise<EvaluationResult> {
  const start = Date.now();
  try {
    let rawAnswer: string;
    if (model.provider === "openai") {
      rawAnswer = await evaluateOpenAI(audioBuffer, question);
    } else {
      rawAnswer = await evaluateGemini(audioBuffer, mimeType, question, model.id);
    }

    return {
      modelId: model.id,
      modelName: model.name,
      provider: model.provider,
      rawAnswer,
      isCorrect: answersMatch(rawAnswer, expectedAnswer),
      latencyMs: Date.now() - start,
      error: null,
    };
  } catch (err) {
    return {
      modelId: model.id,
      modelName: model.name,
      provider: model.provider,
      rawAnswer: null,
      isCorrect: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
