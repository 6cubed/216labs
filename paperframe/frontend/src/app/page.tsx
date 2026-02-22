"use client";

import { useState, useCallback } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import UploadZone from "@/components/upload-zone";
import SegmentationCanvas from "@/components/segmentation-canvas";
import FrameNavigator from "@/components/frame-navigator";
import type { ProcessResponse } from "@/lib/types";

type AppState = "idle" | "uploading" | "done" | "error";

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [error, setError] = useState("");

  const handleFile = useCallback(async (file: File) => {
    setState("uploading");
    setError("");
    setProgress("Uploading...");
    setFrameIndex(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setProgress(
        file.type.startsWith("video/")
          ? "Processing video frames (this may take a while)..."
          : "Segmenting and captioning..."
      );

      const res = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail || "Processing failed");
      }

      const data: ProcessResponse = await res.json();
      setResult(data);
      setState("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setState("error");
    }
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setResult(null);
    setError("");
    setProgress("");
    setFrameIndex(0);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Paperframe</h1>
          </div>

          {state === "done" && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)]
                hover:text-white hover:border-indigo-500/50 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              New upload
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10">
        {state === "idle" && (
          <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold tracking-tight mb-3">
                Segment anything, caption everything
              </h2>
              <p className="text-[var(--text-muted)] text-lg max-w-lg mx-auto">
                Upload a photo or video and Paperframe will identify every
                object, giving you an interactive segmentation map with
                automatic captions.
              </p>
            </div>
            <UploadZone onFile={handleFile} />
          </div>
        )}

        {state === "uploading" && (
          <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center pulse-ring">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
            </div>
            <p className="mt-6 text-lg font-medium">{progress}</p>
            <p className="text-sm text-[var(--text-muted)] mt-2">
              Running Segment Anything + BLIP captioning
            </p>
            <div className="w-64 h-1 mt-6 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div className="h-full rounded-full shimmer bg-indigo-500/30" style={{ width: "100%" }} />
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="max-w-md mx-auto text-center py-20 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">!</span>
            </div>
            <p className="text-lg font-medium mb-2">Processing failed</p>
            <p className="text-[var(--text-muted)] mb-6">{error}</p>
            <button
              type="button"
              onClick={reset}
              className="px-6 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {state === "done" && result && (
          <div>
            {result.type === "video" && (
              <FrameNavigator
                current={frameIndex}
                total={result.frames.length}
                onChange={setFrameIndex}
              />
            )}
            <SegmentationCanvas frame={result.frames[frameIndex]} />
            {result.type === "video" && (
              <FrameNavigator
                current={frameIndex}
                total={result.frames.length}
                onChange={setFrameIndex}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-6">
        <p className="text-center text-xs text-[var(--text-muted)]">
          Powered by SAM + BLIP &middot; Paperframe
        </p>
      </footer>
    </div>
  );
}
