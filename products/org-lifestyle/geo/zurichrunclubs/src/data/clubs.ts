/**
 * Timetable rows for Zurich-area run sessions.
 *
 * evidenceUrl must not be a platform homepage (e.g. instagram.com/, telegram.org/).
 * Prefer: Meetup event search scoped to Zurich, Strava club search, Instagram hashtag/location
 * feeds, official program pages, or other URLs where a visitor can verify an upcoming run.
 * Replace placeholder club names and URLs with real clubs and permalinks when you have them.
 */

export type RunClub = {
  club: string;
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  startTime: string;
  meetup: string;
  pace: string;
  /** Short label for the link (what kind of evidence opens). */
  linkLabel: string;
  /** Permalink or filtered listing — not a generic app homepage. */
  evidenceUrl: string;
};

/** Zurich + in-person + running category, sorted by date (find upcoming sessions). */
const meetupZurichRunningEvents =
  "https://www.meetup.com/find/?location=ch--Zurich&source=EVENTS&eventType=inPerson&categoryId=933&sortField=DATETIME&distance=twentyFiveMiles";

function meetupZurichEventsWithKeywords(keywords: string): string {
  return `https://www.meetup.com/find/?keywords=${encodeURIComponent(keywords)}&location=ch--Zurich&source=EVENTS&eventType=inPerson&categoryId=933&sortField=DATETIME&distance=twentyFiveMiles`;
}

function meetupZurichRunningGroups(): string {
  return "https://www.meetup.com/find/?location=ch--Zurich&source=GROUPS&keywords=running&distance=twentyFiveMiles";
}

function stravaClubSearch(query: string): string {
  return `https://www.strava.com/clubs/search?query=${encodeURIComponent(query)}`;
}

function instagramTag(tag: string): string {
  const t = tag.replace(/^#/, "");
  return `https://www.instagram.com/explore/tags/${encodeURIComponent(t)}/`;
}

export const clubs: RunClub[] = [
  {
    club: "Zurich Run Collective",
    day: "Mon",
    startTime: "18:30",
    meetup: "Sihlcity entrance",
    pace: "5:00-6:00 / km",
    linkLabel: "Instagram · #zurichrunning (recent posts)",
    evidenceUrl: instagramTag("zurichrunning"),
  },
  {
    club: "Oerlikon Base Miles",
    day: "Mon",
    startTime: "19:00",
    meetup: "Oerlikon station, platform hall",
    pace: "5:10-6:10 / km",
    linkLabel: "Strava · club search “Zurich”",
    evidenceUrl: stravaClubSearch("Zurich running"),
  },
  {
    club: "Limmat Morning Crew",
    day: "Tue",
    startTime: "06:30",
    meetup: "Buerkliplatz (lakeside)",
    pace: "4:40-5:20 / km",
    linkLabel: "Meetup · Zurich running groups (chat links in descriptions)",
    evidenceUrl: meetupZurichRunningGroups(),
  },
  {
    club: "Zurich HB Lunch Loop",
    day: "Tue",
    startTime: "12:15",
    meetup: "Zurich HB main hall clock",
    pace: "4:45-5:30 / km",
    linkLabel: "Meetup · events (check descriptions for chat links)",
    evidenceUrl: meetupZurichEventsWithKeywords("lunch run"),
  },
  {
    club: "West End Strides",
    day: "Tue",
    startTime: "18:45",
    meetup: "Hardbruecke station front",
    pace: "5:15-6:00 / km",
    linkLabel: "Instagram · #zurichrunners",
    evidenceUrl: instagramTag("zurichrunners"),
  },
  {
    club: "ETH Hill Repeats",
    day: "Wed",
    startTime: "19:00",
    meetup: "ETH Polyterrasse",
    pace: "Intervals (mixed)",
    linkLabel: "ASVZ · sport program (ETH/UZH)",
    evidenceUrl: "https://www.asvz.ch/en/pages/sportprogramm",
  },
  {
    club: "Zurich Lakeside Intervals",
    day: "Wed",
    startTime: "06:45",
    meetup: "Bellevue lakeside",
    pace: "Intervals (mixed)",
    linkLabel: "Zürich Tourism · search “running”",
    evidenceUrl: "https://www.zuerich.com/en/search?query=running",
  },
  {
    club: "Seefeld Sunset Runners",
    day: "Wed",
    startTime: "18:30",
    meetup: "Seefeld Kreuzplatz",
    pace: "5:20-6:20 / km",
    linkLabel: "Meetup · Zurich running events",
    evidenceUrl: meetupZurichEventsWithKeywords("social run"),
  },
  {
    club: "Zurich Social Runners",
    day: "Thu",
    startTime: "18:45",
    meetup: "Europaallee plaza",
    pace: "5:15-6:15 / km",
    linkLabel: "Meetup · Zurich running events",
    evidenceUrl: meetupZurichEventsWithKeywords("social run"),
  },
  {
    club: "Campus Tempo Zurich",
    day: "Thu",
    startTime: "19:15",
    meetup: "Irchel campus main square",
    pace: "4:20-5:00 / km",
    linkLabel: "Strava · club search “Zürich”",
    evidenceUrl: stravaClubSearch("Zürich"),
  },
  {
    club: "Old Town Easy Run",
    day: "Thu",
    startTime: "07:00",
    meetup: "Rathaus bridge",
    pace: "5:45-6:30 / km",
    linkLabel: "Meetup · running groups",
    evidenceUrl: meetupZurichRunningGroups(),
  },
  {
    club: "Friday Riverside Tempo",
    day: "Fri",
    startTime: "07:00",
    meetup: "Bellevue tram stop",
    pace: "4:20-5:00 / km",
    linkLabel: "Meetup · events (verify date/time on listing)",
    evidenceUrl: meetupZurichRunningEvents,
  },
  {
    club: "ETH Friday Run Club",
    day: "Fri",
    startTime: "18:45",
    meetup: "ETH Polyterrasse",
    pace: "4:40-5:30 / km",
    linkLabel: "ETH · Sport (official)",
    evidenceUrl: "https://www.sport.ethz.ch/",
  },
  {
    club: "Zurich Friday Social 5K",
    day: "Fri",
    startTime: "19:00",
    meetup: "Europaallee plaza",
    pace: "5:10-6:00 / km",
    linkLabel: "Instagram · #zurich5k",
    evidenceUrl: instagramTag("zurich5k"),
  },
  {
    club: "Uetliberg Long Run",
    day: "Sat",
    startTime: "08:00",
    meetup: "Zurich HB, track 21",
    pace: "5:20-6:20 / km",
    linkLabel: "Meetup · trail / long run",
    evidenceUrl: meetupZurichEventsWithKeywords("trail long run"),
  },
  {
    club: "Saturday Track Session",
    day: "Sat",
    startTime: "10:00",
    meetup: "Letzigrund stadium gate",
    pace: "Intervals / coached",
    linkLabel: "Zürich Tourism · running",
    evidenceUrl: "https://www.zuerich.com/en/search?query=running",
  },
  {
    club: "Sihl Riverside Recovery",
    day: "Sat",
    startTime: "16:00",
    meetup: "Kasernenareal",
    pace: "6:00-6:45 / km",
    linkLabel: "Meetup · Zurich running events",
    evidenceUrl: meetupZurichEventsWithKeywords("recovery easy"),
  },
  {
    club: "Lake Loop Recovery Club",
    day: "Sun",
    startTime: "09:30",
    meetup: "Chinagarten Zurich",
    pace: "6:00-6:45 / km",
    linkLabel: "Instagram · #zurichlaufen",
    evidenceUrl: instagramTag("zurichlaufen"),
  },
  {
    club: "Sunday Coffee Runners",
    day: "Sun",
    startTime: "10:00",
    meetup: "Buerkliplatz kiosk",
    pace: "5:30-6:30 / km",
    linkLabel: "Meetup · Sunday social",
    evidenceUrl: meetupZurichEventsWithKeywords("sunday coffee"),
  },
  {
    club: "Zurich Half Prep Group",
    day: "Sun",
    startTime: "08:30",
    meetup: "Sihlcity footbridge",
    pace: "4:50-5:40 / km",
    linkLabel: "Strava · club search “half marathon”",
    evidenceUrl: stravaClubSearch("Zurich half marathon"),
  },
];

export const dayOrder: RunClub["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const dayFull: Record<RunClub["day"], string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};
