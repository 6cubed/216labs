"use client";

import dynamic from "next/dynamic";

const ShannonViewer = dynamic(() => import("./ShannonViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] flex-1 items-center justify-center text-muted text-sm">
      Loading map…
    </div>
  ),
});

export function MapLoader() {
  return <ShannonViewer />;
}
