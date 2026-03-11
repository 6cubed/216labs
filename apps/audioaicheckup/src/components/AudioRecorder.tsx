"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Play, Pause, Trash2, Upload } from "lucide-react";

interface AudioRecorderProps {
  onAudioReady: (blob: Blob | null, mimeType: string) => void;
}

export function AudioRecorder({ onAudioReady }: AudioRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "recorded">("idle");
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");

  const MAX_DURATION = 30 * 60;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      mimeTypeRef.current = mimeType;

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        if (audioRef.current) audioRef.current.src = url;
        setState("recorded");
        setFileInfo(`${(blob.size / 1024).toFixed(0)} KB recorded`);
        onAudioReady(blob, "audio/webm");
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(500);
      startTimeRef.current = Date.now();
      setState("recording");

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= MAX_DURATION) stopRecording();
      }, 500);
    } catch {
      alert("Microphone access denied. Please allow microphone access and try again.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTimer]);

  const stopRecording = useCallback(() => {
    stopTimer();
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
  }, [stopTimer]);

  const clearRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    setAudioUrl(null);
    setFileInfo(null);
    setState("idle");
    setDuration(0);
    setIsPlaying(false);
    onAudioReady(null, "");
  }, [audioUrl, onAudioReady]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying((p) => !p);
  }, [isPlaying]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    if (audioRef.current) audioRef.current.src = url;
    setState("recorded");
    setDuration(0);
    setFileInfo(`${file.name} · ${(file.size / 1024).toFixed(0)} KB`);
    onAudioReady(file, file.type || "audio/webm");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [audioUrl, onAudioReady]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => setIsPlaying(false);
    return () => {
      stopTimer();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {state === "idle" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={startRecording}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-brand-500/50 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center group-hover:bg-brand-500/30 transition-colors">
              <Mic className="w-6 h-6 text-brand-400" />
            </div>
            <span className="text-sm font-medium text-slate-300">Record Audio</span>
            <span className="text-xs text-slate-500">Up to 30 minutes</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-brand-500/50 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
              <Upload className="w-6 h-6 text-slate-400" />
            </div>
            <span className="text-sm font-medium text-slate-300">Upload File</span>
            <span className="text-xs text-slate-500">MP3, WAV, WebM, OGG</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {state === "recording" && (
        <div className="flex flex-col items-center gap-4 p-6 rounded-xl border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 font-mono text-lg font-semibold">
              {formatTime(duration)}
            </span>
            <span className="text-slate-500 text-sm">/ 30:00 max</span>
          </div>
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors font-medium"
          >
            <Square className="w-4 h-4 fill-current" />
            Stop Recording
          </button>
        </div>
      )}

      {state === "recorded" && (
        <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-slate-300 font-medium">Audio ready</span>
              {fileInfo && (
                <span className="text-xs text-slate-500 ml-1">{fileInfo}</span>
              )}
            </div>
            <button
              onClick={clearRecording}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Remove audio"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayback}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500/20 border border-brand-500/30 text-brand-400 hover:bg-brand-500/30 transition-colors text-sm font-medium"
            >
              {isPlaying ? (
                <><Pause className="w-3.5 h-3.5" /> Pause</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> Play back</>
              )}
            </button>
            {duration > 0 && (
              <span className="text-slate-500 text-sm font-mono">
                {formatTime(duration)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
