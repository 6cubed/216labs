"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { FrameResult, Segment, MaskRLE } from "@/lib/types";

interface SegmentationCanvasProps {
  frame: FrameResult;
}

function decodeMaskRLE(rle: MaskRLE, width: number, height: number): Uint8Array {
  const total = width * height;
  const mask = new Uint8Array(total);
  let pos = 0;
  let val = rle.startValue;
  for (const len of rle.lengths) {
    if (val === 1) {
      for (let i = pos; i < pos + len && i < total; i++) {
        mask[i] = 1;
      }
    }
    pos += len;
    val = 1 - val;
  }
  return mask;
}

export default function SegmentationCanvas({ frame }: SegmentationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [hoveredSegment, setHoveredSegment] = useState<Segment | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [scale, setScale] = useState(1);
  const decodedMasks = useRef<Map<number, Uint8Array>>(new Map());

  useEffect(() => {
    decodedMasks.current.clear();
    for (const seg of frame.segments) {
      decodedMasks.current.set(
        seg.id,
        decodeMaskRLE(seg.mask_rle, frame.width, frame.height),
      );
    }
  }, [frame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = frame.width;
    canvas.height = frame.height;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      drawOverlay();
    };
    img.src = `data:image/jpeg;base64,${frame.image_b64}`;
  }, [frame]);

  useEffect(() => {
    function updateScale() {
      const container = containerRef.current;
      if (!container) return;
      const containerW = container.clientWidth;
      setScale(Math.min(1, containerW / frame.width));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [frame.width]);

  const drawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    overlay.width = frame.width;
    overlay.height = frame.height;
    ctx.clearRect(0, 0, frame.width, frame.height);

    const active = selectedSegment || hoveredSegment;

    for (const seg of frame.segments) {
      const mask = decodedMasks.current.get(seg.id);
      if (!mask) continue;

      const isActive = active?.id === seg.id;
      const [r, g, b] = seg.color;
      const alpha = isActive ? 0.55 : 0.25;

      const imgData = ctx.createImageData(frame.width, frame.height);
      for (let i = 0; i < mask.length; i++) {
        if (mask[i]) {
          imgData.data[i * 4] = r;
          imgData.data[i * 4 + 1] = g;
          imgData.data[i * 4 + 2] = b;
          imgData.data[i * 4 + 3] = Math.round(alpha * 255);
        }
      }
      ctx.putImageData(imgData, 0, 0);

      if (isActive) {
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = 2;
        const { x, y, w, h } = seg.bbox;
        ctx.strokeRect(x, y, w, h);
      }
    }
  }, [frame, hoveredSegment, selectedSegment]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  const handleCanvasMove = useCallback(
    (e: React.MouseEvent) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / scale);
      const y = Math.round((e.clientY - rect.top) / scale);

      for (let i = frame.segments.length - 1; i >= 0; i--) {
        const seg = frame.segments[i];
        const mask = decodedMasks.current.get(seg.id);
        if (mask && y >= 0 && y < frame.height && x >= 0 && x < frame.width) {
          if (mask[y * frame.width + x]) {
            setHoveredSegment(seg);
            return;
          }
        }
      }
      setHoveredSegment(null);
    },
    [frame, scale],
  );

  const handleClick = useCallback(() => {
    setSelectedSegment((prev) =>
      prev?.id === hoveredSegment?.id ? null : hoveredSegment ?? null,
    );
  }, [hoveredSegment]);

  const active = selectedSegment || hoveredSegment;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Canvas area */}
        <div className="flex-1 min-w-0">
          <div
            ref={containerRef}
            className="relative rounded-xl overflow-hidden bg-[var(--surface)] border border-[var(--border)]"
            style={{ maxWidth: frame.width }}
          >
            <canvas
              ref={canvasRef}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 cursor-crosshair"
              style={{ width: "100%", height: "auto" }}
              onMouseMove={handleCanvasMove}
              onMouseLeave={() => setHoveredSegment(null)}
              onClick={handleClick}
            />

            {active && (
              <div
                className="absolute pointer-events-none px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur text-sm font-medium text-white shadow-lg border border-white/10 max-w-[240px] truncate"
                style={{
                  left: `${(active.bbox.x + active.bbox.w / 2) * scale}px`,
                  top: `${Math.max(0, active.bbox.y * scale - 36)}px`,
                  transform: "translateX(-50%)",
                }}
              >
                {active.caption}
              </div>
            )}
          </div>
        </div>

        {/* Segment list sidebar */}
        <div className="lg:w-72 shrink-0">
          <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Segments ({frame.segments.length})
          </h3>
          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
            {frame.segments.map((seg) => {
              const isActive = active?.id === seg.id;
              const [r, g, b] = seg.color;
              return (
                <button
                  key={seg.id}
                  type="button"
                  className={`
                    w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150
                    flex items-start gap-3
                    ${isActive
                      ? "bg-[var(--surface-2)] ring-1 ring-indigo-500/40"
                      : "hover:bg-[var(--surface)] bg-transparent"
                    }
                  `}
                  onMouseEnter={() => setHoveredSegment(seg)}
                  onMouseLeave={() => setHoveredSegment(null)}
                  onClick={() =>
                    setSelectedSegment((prev) =>
                      prev?.id === seg.id ? null : seg,
                    )
                  }
                >
                  <span
                    className="mt-1 w-3 h-3 rounded-full shrink-0"
                    style={{ background: `rgb(${r},${g},${b})` }}
                  />
                  <span className="text-sm leading-snug">{seg.caption}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
