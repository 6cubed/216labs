"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface UploadZoneProps {
  onImageSelected: (dataUrl: string) => void;
  currentImage: string | null;
  onClear: () => void;
}

export default function UploadZone({
  onImageSelected,
  currentImage,
  onClear,
}: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onImageSelected(reader.result);
        }
      };
      reader.readAsDataURL(file);
    },
    [onImageSelected]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false),
  });

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {currentImage ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative mx-auto overflow-hidden rounded-2xl border border-surface-200 shadow-lg"
          >
            <img
              src={currentImage}
              alt="Your room"
              className="h-64 w-full object-cover"
            />
            <button
              onClick={onClear}
              className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/40 to-transparent px-4 pb-3 pt-8">
              <p className="text-sm font-medium text-white/90">Room photo uploaded</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              {...getRootProps()}
              className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
                isDragActive
                  ? "border-brand-400 bg-brand-50/50 scale-[1.02]"
                  : "border-surface-300 hover:border-brand-300 hover:bg-brand-50/20"
              }`}
            >
              <input {...getInputProps()} />
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100/60 text-brand-500 transition-transform duration-300 group-hover:scale-110">
                {isDragActive ? (
                  <ImageIcon className="h-7 w-7" />
                ) : (
                  <Upload className="h-7 w-7" />
                )}
              </div>
              <p className="text-lg font-medium text-surface-800">
                {isDragActive ? "Drop your room photo here" : "Upload a room photo"}
              </p>
              <p className="mt-1.5 text-sm text-surface-800/50">
                Drag & drop or click to browse — JPG, PNG, WebP up to 20 MB
              </p>
              <p className="mt-1 text-xs text-surface-800/35">
                Best results: wide-angle shots showing the full room
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
