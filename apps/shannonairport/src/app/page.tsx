import { MapLoader } from "@/components/MapLoader";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-border bg-surface-light px-4 py-3">
        <p className="text-xs text-muted">
          Imagery: Esri, USGS, EOX, NASA GIBS — see attributions on map. For
          investigation, corroborate with primary sources and not-for-profit
          reporting.
        </p>
      </header>
      <div className="flex min-h-0 flex-1">
        <MapLoader />
      </div>
    </div>
  );
}
