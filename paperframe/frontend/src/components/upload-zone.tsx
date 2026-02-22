"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, ImageIcon, Film } from "lucide-react";

interface UploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export default function UploadZone({ onFile, disabled }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile, disabled],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      disabled={disabled}
      className={`
        group relative w-full rounded-2xl border-2 border-dashed
        transition-all duration-300 cursor-pointer
        flex flex-col items-center justify-center gap-4 py-20 px-8
        ${dragOver
          ? "border-indigo-500 bg-indigo-500/5 scale-[1.01]"
          : "border-[var(--border)] hover:border-indigo-500/50 hover:bg-[var(--surface)]"
        }
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      <div
        className={`
          rounded-full p-4 transition-colors duration-300
          ${dragOver ? "bg-indigo-500/20" : "bg-[var(--surface-2)] group-hover:bg-indigo-500/10"}
        `}
      >
        <Upload className="w-8 h-8 text-[var(--text-muted)] group-hover:text-indigo-400 transition-colors" />
      </div>

      <div className="text-center">
        <p className="text-lg font-medium text-[var(--text)]">
          Drop an image or video here
        </p>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          or click to browse
        </p>
      </div>

      <div className="flex gap-3 mt-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--surface-2)] rounded-full px-3 py-1.5">
          <ImageIcon className="w-3.5 h-3.5" /> JPG, PNG, WebP
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--surface-2)] rounded-full px-3 py-1.5">
          <Film className="w-3.5 h-3.5" /> MP4, WebM, MOV
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleChange}
        className="hidden"
      />
    </button>
  );
}
