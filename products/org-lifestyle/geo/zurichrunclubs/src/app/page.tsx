import { unstable_noStore as noStore } from "next/cache";

import { clubs, dayFull, dayOrder, type RunClub } from "@/data/clubs";

export const dynamic = "force-dynamic";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** One row per distinct start time (sorted early → late); columns are weekdays — like a class timetable. */
function buildTimetableRows(): { time: string; byDay: Record<RunClub["day"], RunClub[]> }[] {
  const times = [...new Set(clubs.map((c) => c.startTime))].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  return times.map((time) => {
    const byDay = {} as Record<RunClub["day"], RunClub[]>;
    for (const d of dayOrder) byDay[d] = [];
    for (const c of clubs) {
      if (c.startTime === time) byDay[c.day].push(c);
    }
    return { time, byDay };
  });
}

function SessionBlock({ item }: { item: RunClub }) {
  const hint = `Confirm this week’s ${dayFull[item.day]} ${item.startTime} run on the page you open (filter by date where available).`;
  return (
    <div
      style={{
        padding: "0.45rem 0.5rem",
        borderRadius: 8,
        background: "rgba(20, 36, 71, 0.85)",
        border: "1px solid #3d5a9e",
        marginBottom: "0.4rem",
      }}
    >
      <div style={{ fontWeight: 700, color: "#f2f6ff", fontSize: "0.88rem", lineHeight: 1.25 }}>{item.club}</div>
      <div style={{ color: "#b8c9f0", fontSize: "0.78rem", marginTop: "0.2rem" }}>{item.meetup}</div>
      <div style={{ color: "#9eb4e8", fontSize: "0.74rem", marginTop: "0.15rem" }}>{item.pace}</div>
      <a
        href={item.evidenceUrl}
        target="_blank"
        rel="noreferrer"
        title={hint}
        style={{ color: "#9fbeff", fontSize: "0.76rem", marginTop: "0.35rem", display: "inline-block" }}
      >
        {item.linkLabel} →
      </a>
    </div>
  );
}

export default function Page() {
  noStore();
  const rows = buildTimetableRows();
  const stickyTimeBg = "#142447";
  const cellBorder = "1px solid #2f4478";

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1rem 3rem" }}>
      <h1 style={{ marginTop: 0, fontSize: "2rem" }}>Zurich Run Clubs</h1>
      <p style={{ color: "#9eb4e8", fontSize: "0.95rem", marginTop: "-0.25rem" }}>
        {clubs.length} sessions — days across the top, start times down the side (school-style grid).
      </p>
      <p style={{ color: "#c8d6ff", maxWidth: 880 }}>
        Each cell lists runs starting that day at that time. Links open filtered listings, hashtag feeds, club search, or
        official program pages — not generic app homepages. Use the destination’s calendar or date filter to verify that
        week’s session before you head out.
      </p>

      <section
        style={{
          marginTop: "1.25rem",
          background: "linear-gradient(180deg, #17264c 0%, #111b35 100%)",
          border: "1px solid #37518f",
          borderRadius: 12,
          overflow: "auto",
          maxHeight: "min(85vh, 900px)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            minWidth: 720,
          }}
        >
          <thead>
            <tr style={{ background: "#142447" }}>
              <th
                scope="col"
                style={{
                  position: "sticky",
                  top: 0,
                  left: 0,
                  zIndex: 3,
                  padding: "0.65rem 0.5rem",
                  textAlign: "left",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "#9eb4e8",
                  borderBottom: cellBorder,
                  borderRight: cellBorder,
                  background: stickyTimeBg,
                  minWidth: 72,
                }}
              >
                Time
              </th>
              {dayOrder.map((d) => (
                <th
                  key={d}
                  scope="col"
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    padding: "0.65rem 0.45rem",
                    textAlign: "center",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#dde8ff",
                    borderBottom: cellBorder,
                    borderRight: cellBorder,
                    background: "#142447",
                    minWidth: 128,
                  }}
                  title={dayFull[d]}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ time, byDay }) => (
              <tr key={time}>
                <th
                  scope="row"
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 1,
                    padding: "0.55rem 0.5rem",
                    textAlign: "right",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    color: "#d1dcff",
                    borderBottom: cellBorder,
                    borderRight: cellBorder,
                    background: stickyTimeBg,
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}
                >
                  {time}
                </th>
                {dayOrder.map((d) => {
                  const sessions = byDay[d];
                  return (
                    <td
                      key={`${time}-${d}`}
                      style={{
                        padding: "0.4rem",
                        borderBottom: cellBorder,
                        borderRight: cellBorder,
                        verticalAlign: "top",
                        background: sessions.length ? "rgba(15, 24, 48, 0.5)" : "rgba(8, 12, 24, 0.35)",
                        minWidth: 128,
                      }}
                    >
                      {sessions.length === 0 ? (
                        <span style={{ color: "#4a5f8f", fontSize: "0.85rem" }}>—</span>
                      ) : (
                        sessions.map((item) => (
                          <SessionBlock key={`${d}-${time}-${item.club}`} item={item} />
                        ))
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p style={{ marginTop: "1rem", color: "#9eb4e8", fontSize: "0.92rem" }}>
        Note: replace placeholder club names and listing URLs in <code style={{ color: "#c8d6ff" }}>src/data/clubs.ts</code>{" "}
        with real clubs and permalinks (Meetup events, Strava club pages, public Telegram/Instagram posts) when you have
        them. Run clubs often change for weather, routes, or race-day adjustments — always double-check on the source.
      </p>
    </main>
  );
}
