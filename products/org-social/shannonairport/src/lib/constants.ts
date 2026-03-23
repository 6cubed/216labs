/** Shannon Airport (EINN) — approximate airfield center */
export const SHANNON = { lat: 52.7019, lng: -8.9248 } as const;

/** Bounding box for OpenSky ADS-B queries (degrees) */
export const OPENSKY_BBOX = {
  lamin: 52.45,
  lamax: 52.95,
  lomin: -9.2,
  lomax: -8.65,
} as const;
