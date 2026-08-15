/**
 * Recurring Zurich-area group runs with permalinks a visitor can open this week.
 * evidenceUrl must not be a platform homepage (e.g. instagram.com/, telegram.org/).
 * Prefer club/event pages, Meetup groups, or Strava clubs — not keyword search URLs.
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

/** Clubs that announce each week instead of a fixed timetable slot. */
export type AnnouncedClub = {
  club: string;
  note: string;
  linkLabel: string;
  evidenceUrl: string;
};

export const clubs: RunClub[] = [
  {
    club: "WERUN Runday Monday · Europaallee",
    day: "Mon",
    startTime: "17:45",
    meetup: "WERUN Store Europaallee",
    pace: "Mixed groups (~60 min)",
    linkLabel: "WERUN · Runday Monday",
    evidenceUrl: "https://www.werun.ch/en/runday-monday-2/",
  },
  {
    club: "WERUN Runday Monday · Sihlcity",
    day: "Mon",
    startTime: "18:15",
    meetup: "WERUN Store Sihlcity",
    pace: "Mixed groups (~60 min)",
    linkLabel: "WERUN · Runday Monday",
    evidenceUrl: "https://www.werun.ch/en/runday-monday-2/",
  },
  {
    club: "THE 6:ZH CLUB",
    day: "Tue",
    startTime: "06:15",
    meetup: "Bürkliplatz",
    pace: "~6 km, then coffee",
    linkLabel: "Linktree · 6:ZH (Strava + details)",
    evidenceUrl: "https://linktr.ee/the6zhclub",
  },
  {
    club: "CityRunning Nord",
    day: "Tue",
    startTime: "19:00",
    meetup: "Marktplatz Oerlikon",
    pace: "~6:00 / km, 60 min, drop-in",
    linkLabel: "Meetup · CityRunning Zürich",
    evidenceUrl: "https://www.meetup.com/cityrunning/",
  },
  {
    club: "On Run Club · On Lab",
    day: "Wed",
    startTime: "18:30",
    meetup: "On Lab Zurich, Hardturmstrasse 183",
    pace: "Social / mixed (register — limited spots)",
    linkLabel: "On · Lab Zurich store",
    evidenceUrl: "https://www.on.com/en-ch/store/on-lab-zurich",
  },
  {
    club: "CityRunning Enge",
    day: "Wed",
    startTime: "19:00",
    meetup: "Kiosk/Beiz Hafen, Mythenquai 21",
    pace: "Groups ~6:00 and ~7:00 / km",
    linkLabel: "Meetup · CityRunning Zürich",
    evidenceUrl: "https://www.meetup.com/cityrunning/",
  },
  {
    club: "District Runners Zürich",
    day: "Thu",
    startTime: "19:00",
    meetup: "Grand Café Lochergut, Badenerstrasse 230",
    pace: "~7 km, pace matches who shows up",
    linkLabel: "Meetup · District Runners",
    evidenceUrl: "https://www.meetup.com/district-runners-zurich/",
  },
  {
    club: "CityRunning Altstetten",
    day: "Thu",
    startTime: "19:00",
    meetup: "Lindenplatz, Altstetten",
    pace: "Groups ~6:00 and ~7:00 / km",
    linkLabel: "Meetup · CityRunning Zürich",
    evidenceUrl: "https://www.meetup.com/cityrunning/",
  },
  {
    club: "Zurich Hash House Harriers",
    day: "Thu",
    startTime: "19:00",
    meetup: "New location each week (usually Zone 10)",
    pace: "Social trail ~4–7 km + drinks after (CHF 5)",
    linkLabel: "ZH3 · this week’s hash",
    evidenceUrl: "https://www.meetup.com/the-zurich-hash-house-harriers/",
  },
  {
    club: "Founders Running Club · Zurich",
    day: "Sat",
    startTime: "10:00",
    meetup: "Seebad Utoquai, then Frascati Café",
    pace: "Easy 5K + coffee",
    linkLabel: "Meetup · FRC Zurich",
    evidenceUrl: "https://www.meetup.com/founders-running-club-zurich/",
  },
];

export const announcedThisWeek: AnnouncedClub[] = [
  {
    club: "THE RUN CLUB ZURICH",
    note: "Large social club — this week’s session is posted on Strava, not a fixed weekday slot.",
    linkLabel: "Strava · THE RUN CLUB ZURICH",
    evidenceUrl: "https://www.strava.com/clubs/TRCZH",
  },
  {
    club: "ASVZ Running",
    note: "ETH/UZH member trainings (Fluntern and others). Search Running in the program; registration required.",
    linkLabel: "ASVZ · sport program",
    evidenceUrl: "https://asvz.ch/",
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
