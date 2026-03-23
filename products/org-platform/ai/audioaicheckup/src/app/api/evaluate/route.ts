import { NextRequest, NextResponse } from "next/server";
import { writeFileSync } from "fs";
import { join } from "path";
import { getAudioDir, insertSubmission, insertEvaluation } from "@/lib/db";
import { MODELS, evaluateWithModel } from "@/lib/models";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audioFile = formData.get("audio") as File | null;
  const question = (formData.get("question") as string | null)?.trim();
  const expectedAnswer = (formData.get("expected_answer") as string | null)?.trim();

  if (!audioFile || !question || !expectedAnswer) {
    return NextResponse.json(
      { error: "Missing required fields: audio, question, expected_answer" },
      { status: 400 }
    );
  }

  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (audioFile.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Audio file too large. Maximum 50MB." },
      { status: 400 }
    );
  }

  const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
  const mimeType = audioFile.type || "audio/webm";

  const ext = mimeType.includes("mp3") ? "mp3"
    : mimeType.includes("wav") ? "wav"
    : mimeType.includes("ogg") ? "ogg"
    : "webm";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const audioDir = getAudioDir();
  writeFileSync(join(audioDir, filename), audioBuffer);

  const submissionId = insertSubmission({
    audio_filename: filename,
    audio_size_bytes: audioFile.size,
    question,
    expected_answer: expectedAnswer,
  });

  const results = await Promise.all(
    MODELS.map((model) =>
      evaluateWithModel(audioBuffer, mimeType, question, expectedAnswer, model)
    )
  );

  for (const result of results) {
    insertEvaluation({
      submission_id: submissionId,
      model_id: result.modelId,
      model_name: result.modelName,
      provider: result.provider,
      raw_answer: result.rawAnswer,
      is_correct: result.isCorrect ? 1 : 0,
      latency_ms: result.latencyMs,
      error: result.error,
    });
  }

  return NextResponse.json({
    submissionId,
    question,
    expectedAnswer,
    results,
  });
}
