"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { SHANNON } from "@/lib/constants";

type LayerId = "esri" | "usgs" | "eox_s2" | "modis" | "viirs";

const LAYER_LABELS: Record<LayerId, string> = {
  esri: "Esri World Imagery (latest)",
  usgs: "USGS National Map imagery",
  eox_s2: "Sentinel-2 cloudless mosaic (EOX, ~2020)",
  modis: "NASA MODIS Terra true color (dated)",
  viirs: "NASA VIIRS SNPP true color (dated)",
};

function defaultGibsDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 5);
  return d.toISOString().slice(0, 10);
}

function makeBaseLayer(id: LayerId, gibsDate: string): L.TileLayer {
  switch (id) {
    case "esri":
      return L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "&copy; Esri, Maxar, Earthstar",
          maxZoom: 22,
        }
      );
    case "usgs":
      return L.tileLayer(
        "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "USGS",
          maxZoom: 16,
        }
      );
    case "eox_s2":
      return L.tileLayer(
        "https://tiles.maps.eox.live/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{x}/{y}.jpg",
        {
          attribution: "Sentinel-2 cloudless &copy; EOX / CC BY-NC-SA 3.0",
          maxZoom: 16,
        }
      );
    case "modis":
      return L.tileLayer(
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/250m/{z}/{y}/{x}.jpg`,
        {
          attribution: "NASA GIBS MODIS",
          maxZoom: 12,
          maxNativeZoom: 9,
        }
      );
    case "viirs":
      return L.tileLayer(
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${gibsDate}/500m/{z}/{y}/{x}.jpg`,
        {
          attribution: "NASA GIBS VIIRS",
          maxZoom: 12,
          maxNativeZoom: 9,
        }
      );
    default:
      return makeBaseLayer("esri", gibsDate);
  }
}

export default function ShannonViewer() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const flightsRef = useRef<L.LayerGroup | null>(null);
  const initDoneRef = useRef(false);
  const [layerId, setLayerId] = useState<LayerId>("esri");
  const [gibsDate, setGibsDate] = useState(defaultGibsDate);
  const maxGibs = defaultGibsDate();
  const [flightError, setFlightError] = useState<string | null>(null);
  const [flightMeta, setFlightMeta] = useState<{
    count: number;
    usCount: number;
  } | null>(null);

  const refreshFlights = useCallback(() => {
    const group = flightsRef.current;
    const map = mapRef.current;
    if (!group || !map) return;

    fetch("/api/opensky")
      .then((r) => r.json())
      .then(
        (data: {
          aircraft?: Array<{
            icao24: string;
            callsign: string | null;
            originCountry: string | null;
            lat: number;
            lon: number;
            altitudeM: number | null;
            onGround: boolean;
            usLinked: boolean;
          }>;
          error?: string;
        }) => {
          if (data.error) {
            setFlightError(data.error);
            setFlightMeta(null);
            return;
          }
          setFlightError(null);
          group.clearLayers();
          const list = data.aircraft ?? [];
          let us = 0;
          for (const ac of list) {
            if (ac.usLinked) us++;
            const color = ac.usLinked ? "#f85149" : "#8b9cb3";
            const r = ac.usLinked ? 7 : 4;
            const m = L.circleMarker([ac.lat, ac.lon], {
              radius: r,
              color,
              weight: 2,
              fillColor: color,
              fillOpacity: 0.55,
            });
            const alt =
              ac.altitudeM != null
                ? `${Math.round(ac.altitudeM)} m geo`
                : "alt unknown";
            const cs = ac.callsign || "—";
            const oc = ac.originCountry || "—";
            m.bindPopup(
              `<div class="text-xs font-mono space-y-1 min-w-[10rem]">
                <div><strong>${ac.icao24}</strong> ${ac.onGround ? "(ground)" : ""}</div>
                <div>Callsign: ${cs}</div>
                <div>Origin country: ${oc}</div>
                <div>${alt}</div>
                ${ac.usLinked ? '<div class="text-red-400">Heuristic: US-linked</div>' : ""}
              </div>`
            );
            m.addTo(group);
          }
          setFlightMeta({ count: list.length, usCount: us });
        }
      )
      .catch(() => {
        setFlightError("Could not load flights");
        setFlightMeta(null);
      });
  }, []);

  useEffect(() => {
    if (!wrapRef.current || initDoneRef.current) return;
    initDoneRef.current = true;

    const map = L.map(wrapRef.current, {
      scrollWheelZoom: true,
    }).setView([SHANNON.lat, SHANNON.lng], 13);

    mapRef.current = map;
    flightsRef.current = L.layerGroup().addTo(map);

    L.circleMarker([SHANNON.lat, SHANNON.lng], {
      radius: 8,
      color: "#3fb950",
      weight: 2,
      fillColor: "#3fb950",
      fillOpacity: 0.9,
    })
      .addTo(map)
      .bindPopup("Shannon Airport (EINN)");

    L.circle([SHANNON.lat, SHANNON.lng], {
      radius: 8000,
      color: "#3fb950",
      weight: 1,
      fillOpacity: 0.04,
    }).addTo(map);

    L.control.scale({ metric: true, imperial: true }).addTo(map);

    refreshFlights();
    const id = window.setInterval(refreshFlights, 60_000);

    return () => {
      window.clearInterval(id);
      initDoneRef.current = false;
      map.remove();
      mapRef.current = null;
      baseRef.current = null;
      flightsRef.current = null;
    };
  }, [refreshFlights]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseRef.current) {
      map.removeLayer(baseRef.current);
      baseRef.current = null;
    }

    const layer = makeBaseLayer(layerId, gibsDate);
    layer.addTo(map);
    baseRef.current = layer;
  }, [layerId, gibsDate]);

  const gibsActive = layerId === "modis" || layerId === "viirs";

  return (
    <div className="flex flex-1 flex-col lg:flex-row min-h-0">
      <aside className="w-full lg:w-[22rem] shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-surface p-4 overflow-y-auto text-sm">
        <h1 className="text-lg font-semibold tracking-tight mb-1">
          Shannon Airport
        </h1>
        <p className="text-muted text-xs leading-relaxed mb-4">
          EINN — public satellite layers with timestamps where providers expose
          them (NASA GIBS daily). Live aircraft from{" "}
          <a
            className="text-accent underline-offset-2 hover:underline"
            href="https://opensky-network.org"
            target="_blank"
            rel="noreferrer"
          >
            OpenSky Network
          </a>{" "}
          (ADS-B gaps apply). US-linked highlighting is a rough heuristic for
          research, not proof of military traffic.
        </p>

        <label className="block text-xs font-medium text-muted mb-1">
          Basemap
        </label>
        <select
          className="w-full mb-3 rounded border border-border bg-surface-light px-2 py-2 text-foreground text-xs"
          value={layerId}
          onChange={(e) => setLayerId(e.target.value as LayerId)}
        >
          {(Object.keys(LAYER_LABELS) as LayerId[]).map((id) => (
            <option key={id} value={id}>
              {LAYER_LABELS[id]}
            </option>
          ))}
        </select>

        {gibsActive && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted mb-1">
              Image date (UTC) — NASA GIBS daily product
            </label>
            <input
              type="date"
              className="w-full rounded border border-border bg-surface-light px-2 py-2 text-foreground text-xs"
              value={gibsDate}
              max={maxGibs}
              onChange={(e) => setGibsDate(e.target.value)}
            />
            <p className="text-[11px] text-muted mt-1">
              Pick a day; recent days may lag. Change the date to compare
              surface and weather patterns over time.
            </p>
          </div>
        )}

        <div className="border-t border-border pt-3 mb-3">
          <h2 className="text-xs font-semibold text-foreground mb-2">
            Live traffic (bbox)
          </h2>
          {flightError && (
            <p className="text-warn text-xs mb-2">{flightError}</p>
          )}
          {flightMeta && (
            <p className="text-xs text-muted">
              {flightMeta.count} aircraft ·{" "}
              <span className="text-red-400">{flightMeta.usCount}</span>{" "}
              heuristic US-linked
            </p>
          )}
          <button
            type="button"
            className="mt-2 text-xs text-accent underline-offset-2 hover:underline"
            onClick={() => refreshFlights()}
          >
            Refresh now
          </button>
        </div>

        <div className="border-t border-border pt-3">
          <h2 className="text-xs font-semibold text-foreground mb-2">
            More imagery & data (opens in new tab)
          </h2>
          <ul className="space-y-1.5 text-xs text-accent">
            <li>
              <a
                href="https://browser.dataspace.copernicus.eu/?zoom=14&lat=52.7019&lng=-8.9248&layerId=OPTICAL"
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                Copernicus Browser (Sentinel)
              </a>
            </li>
            <li>
              <a
                href="https://apps.sentinel-hub.com/eo-browser/?zoom=14&lat=52.7019&lng=-8.9248&themeId=DEFAULT_THEME"
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                Sentinel Hub EO Browser
              </a>
            </li>
            <li>
              <a
                href="https://worldview.earthdata.nasa.gov/?v=-8.9248%2C52.5019%2C-8.7248%2C52.9019&l=Reference_Labels_15m%2CCoastlines_15m%2CBlueMarble_NextGeneration%2CMODIS_Terra_CorrectedReflectance_TrueColor&lg=true"
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                NASA Worldview (time slider)
              </a>
            </li>
            <li>
              <a
                href="https://en.wikipedia.org/wiki/Shannon_Airport#U.S._military_stopovers"
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                Wikipedia — context on stopovers
              </a>
            </li>
          </ul>
        </div>
      </aside>

      <div
        ref={wrapRef}
        className="flex-1 min-h-[420px] lg:min-h-0 w-full"
        style={{ minHeight: "420px" }}
      />
    </div>
  );
}
