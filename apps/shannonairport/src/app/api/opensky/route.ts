import { NextResponse } from "next/server";
import { isUsLinkedFlight } from "@/lib/flight-heuristics";
import { OPENSKY_BBOX } from "@/lib/constants";

export const dynamic = "force-dynamic";

type OpenSkyState = (string | number | boolean | number[] | null)[];

interface AircraftRow {
  icao24: string;
  callsign: string | null;
  originCountry: string | null;
  lat: number;
  lon: number;
  altitudeM: number | null;
  onGround: boolean;
  usLinked: boolean;
}

export async function GET() {
  const params = new URLSearchParams({
    lamin: String(OPENSKY_BBOX.lamin),
    lamax: String(OPENSKY_BBOX.lamax),
    lomin: String(OPENSKY_BBOX.lomin),
    lomax: String(OPENSKY_BBOX.lomax),
  });

  const upstream = await fetch(
    `https://opensky-network.org/api/states/all?${params}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: "OpenSky request failed",
        status: upstream.status,
        aircraft: [] as AircraftRow[],
        fetchedAt: Date.now(),
      },
      { status: 502 }
    );
  }

  const data = (await upstream.json()) as {
    time?: number;
    states?: OpenSkyState[] | null;
  };

  const states = data.states ?? [];
  const aircraft: AircraftRow[] = [];

  for (const row of states) {
    if (!row || row.length < 14) continue;
    const lat = row[6] as number | null;
    const lon = row[5] as number | null;
    if (lat == null || lon == null) continue;

    const callsignRaw = row[1] as string | null;
    const callsign = callsignRaw
      ? String(callsignRaw).trim() || null
      : null;
    const originCountry = row[2] != null ? String(row[2]) : null;
    const geoAlt = row[13] as number | null;
    const onGround = Boolean(row[8]);

    const icao24 = String(row[0] ?? "").toLowerCase();
    if (!icao24) continue;

    aircraft.push({
      icao24,
      callsign,
      originCountry,
      lat,
      lon,
      altitudeM: geoAlt,
      onGround,
      usLinked: isUsLinkedFlight({ originCountry, callsign }),
    });
  }

  return NextResponse.json({
    aircraft,
    fetchedAt: Date.now(),
    openskyTime: data.time ?? null,
  });
}
