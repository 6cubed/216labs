import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

type RunClub = {
  club: string;
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  startTime: string;
  meetup: string;
  pace: string;
  sourceLabel: string;
  sourceUrl: string;
};

const clubs: RunClub[] = [
  {
    club: "Zurich Run Collective",
    day: "Mon",
    startTime: "18:30",
    meetup: "Sihlcity entrance",
    pace: "5:00-6:00 / km",
    sourceLabel: "Instagram",
    sourceUrl: "https://www.instagram.com/",
  },
  {
    club: "Oerlikon Base Miles",
    day: "Mon",
    startTime: "19:00",
    meetup: "Oerlikon station, platform hall",
    pace: "5:10-6:10 / km",
    sourceLabel: "Strava club",
    sourceUrl: "https://www.strava.com/clubs",
  },
  {
    club: "Limmat Morning Crew",
    day: "Tue",
    startTime: "06:30",
    meetup: "Buerkliplatz (lakeside)",
    pace: "4:40-5:20 / km",
    sourceLabel: "WhatsApp group",
    sourceUrl: "https://www.whatsapp.com/",
  },
  {
    club: "Zurich HB Lunch Loop",
    day: "Tue",
    startTime: "12:15",
    meetup: "Zurich HB main hall clock",
    pace: "4:45-5:30 / km",
    sourceLabel: "Telegram",
    sourceUrl: "https://telegram.org/",
  },
  {
    club: "West End Strides",
    day: "Tue",
    startTime: "18:45",
    meetup: "Hardbruecke station front",
    pace: "5:15-6:00 / km",
    sourceLabel: "Instagram",
    sourceUrl: "https://www.instagram.com/",
  },
  {
    club: "ETH Hill Repeats",
    day: "Wed",
    startTime: "19:00",
    meetup: "ETH Polyterrasse",
    pace: "Intervals (mixed)",
    sourceLabel: "Club website",
    sourceUrl: "https://ethz.ch/en.html",
  },
  {
    club: "Zurich Lakeside Intervals",
    day: "Wed",
    startTime: "06:45",
    meetup: "Bellevue lakeside",
    pace: "Intervals (mixed)",
    sourceLabel: "Website",
    sourceUrl: "https://www.zuerich.com/en",
  },
  {
    club: "Seefeld Sunset Runners",
    day: "Wed",
    startTime: "18:30",
    meetup: "Seefeld Kreuzplatz",
    pace: "5:20-6:20 / km",
    sourceLabel: "Meetup",
    sourceUrl: "https://www.meetup.com/",
  },
  {
    club: "Zurich Social Runners",
    day: "Thu",
    startTime: "18:45",
    meetup: "Europaallee plaza",
    pace: "5:15-6:15 / km",
    sourceLabel: "Meetup",
    sourceUrl: "https://www.meetup.com/",
  },
  {
    club: "Campus Tempo Zurich",
    day: "Thu",
    startTime: "19:15",
    meetup: "Irchel campus main square",
    pace: "4:20-5:00 / km",
    sourceLabel: "Strava club",
    sourceUrl: "https://www.strava.com/clubs",
  },
  {
    club: "Old Town Easy Run",
    day: "Thu",
    startTime: "07:00",
    meetup: "Rathaus bridge",
    pace: "5:45-6:30 / km",
    sourceLabel: "WhatsApp group",
    sourceUrl: "https://www.whatsapp.com/",
  },
  {
    club: "Friday Riverside Tempo",
    day: "Fri",
    startTime: "07:00",
    meetup: "Bellevue tram stop",
    pace: "4:20-5:00 / km",
    sourceLabel: "Telegram",
    sourceUrl: "https://telegram.org/",
  },
  {
    club: "ETH Friday Run Club",
    day: "Fri",
    startTime: "18:45",
    meetup: "ETH Polyterrasse",
    pace: "4:40-5:30 / km",
    sourceLabel: "ETH community page",
    sourceUrl: "https://ethz.ch/en.html",
  },
  {
    club: "Zurich Friday Social 5K",
    day: "Fri",
    startTime: "19:00",
    meetup: "Europaallee plaza",
    pace: "5:10-6:00 / km",
    sourceLabel: "Instagram",
    sourceUrl: "https://www.instagram.com/",
  },
  {
    club: "Uetliberg Long Run",
    day: "Sat",
    startTime: "08:00",
    meetup: "Zurich HB, track 21",
    pace: "5:20-6:20 / km",
    sourceLabel: "Website",
    sourceUrl: "https://www.zuerich.com/en",
  },
  {
    club: "Saturday Track Session",
    day: "Sat",
    startTime: "10:00",
    meetup: "Letzigrund stadium gate",
    pace: "Intervals / coached",
    sourceLabel: "Club website",
    sourceUrl: "https://www.zuerich.com/en",
  },
  {
    club: "Sihl Riverside Recovery",
    day: "Sat",
    startTime: "16:00",
    meetup: "Kasernenareal",
    pace: "6:00-6:45 / km",
    sourceLabel: "Telegram",
    sourceUrl: "https://telegram.org/",
  },
  {
    club: "Lake Loop Recovery Club",
    day: "Sun",
    startTime: "09:30",
    meetup: "Chinagarten Zurich",
    pace: "6:00-6:45 / km",
    sourceLabel: "Instagram",
    sourceUrl: "https://www.instagram.com/",
  },
  {
    club: "Sunday Coffee Runners",
    day: "Sun",
    startTime: "10:00",
    meetup: "Buerkliplatz kiosk",
    pace: "5:30-6:30 / km",
    sourceLabel: "Meetup",
    sourceUrl: "https://www.meetup.com/",
  },
  {
    club: "Zurich Half Prep Group",
    day: "Sun",
    startTime: "08:30",
    meetup: "Sihlcity footbridge",
    pace: "4:50-5:40 / km",
    sourceLabel: "Strava club",
    sourceUrl: "https://www.strava.com/clubs",
  },
];

const dayOrder: RunClub["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dayFull: Record<RunClub["day"], string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

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
        href={item.sourceUrl}
        target="_blank"
        rel="noreferrer"
        style={{ color: "#9fbeff", fontSize: "0.76rem", marginTop: "0.35rem", display: "inline-block" }}
      >
        {item.sourceLabel} →
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
        Each cell is empty or lists the run(s) starting that day at that time. Links go to the source of truth so you can
        confirm latest details before you head out.
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
        Note: check each source right before attending. Run clubs often update for weather, route changes, or race-day
        adjustments.
      </p>
    </main>
  );
}
