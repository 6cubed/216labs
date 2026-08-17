import type { Metadata } from "next";
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: "Zurich Run Clubs",
  description:
    "Weekly timetable of real Zurich drop-in run clubs with Meetup, Strava, and store permalinks. Confirm each session on the destination before you go.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          background: "#0b1020",
          color: "#edf2ff",
        }}
      >
        <Ga4Script />
        {children}
        <footer
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 1rem 2rem",
            fontSize: "0.8rem",
            color: "#8aa0d0",
          }}
        >
          <a href="https://6cubed.app/#work" style={{ color: "#9fbeff" }}>
            216Labs · paid work
          </a>
        </footer>
      </body>
    </html>
  );
}
