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

function byDayAndTime(a: RunClub, b: RunClub): number {
  const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
  if (dayDiff !== 0) return dayDiff;
  return a.startTime.localeCompare(b.startTime);
}

export default function Page() {
  const sorted = [...clubs].sort(byDayAndTime);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1rem 3rem" }}>
      <h1 style={{ marginTop: 0, fontSize: "2rem" }}>Zurich Run Clubs</h1>
      <p style={{ color: "#c8d6ff", maxWidth: 880 }}>
        A concise weekly timetable of run clubs in Zurich. Every row links to the source of truth (website, WhatsApp,
        Telegram, or social page) so you can confirm latest time and location updates directly.
      </p>

      <section
        style={{
          marginTop: "1.25rem",
          background: "linear-gradient(180deg, #17264c 0%, #111b35 100%)",
          border: "1px solid #37518f",
          borderRadius: 12,
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#142447" }}>
              <th style={{ padding: "0.75rem" }}>Day</th>
              <th style={{ padding: "0.75rem" }}>Time</th>
              <th style={{ padding: "0.75rem" }}>Run Club</th>
              <th style={{ padding: "0.75rem" }}>Meetup Point</th>
              <th style={{ padding: "0.75rem" }}>Typical Pace</th>
              <th style={{ padding: "0.75rem" }}>Source of Truth</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={`${item.day}-${item.startTime}-${item.club}`} style={{ borderTop: "1px solid #2f4478" }}>
                <td style={{ padding: "0.75rem", color: "#dde8ff", fontWeight: 700 }}>{item.day}</td>
                <td style={{ padding: "0.75rem", color: "#d1dcff" }}>{item.startTime}</td>
                <td style={{ padding: "0.75rem", color: "#f2f6ff" }}>{item.club}</td>
                <td style={{ padding: "0.75rem", color: "#c7d5fb" }}>{item.meetup}</td>
                <td style={{ padding: "0.75rem", color: "#c7d5fb" }}>{item.pace}</td>
                <td style={{ padding: "0.75rem" }}>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#9fbeff" }}>
                    {item.sourceLabel}
                  </a>
                </td>
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
