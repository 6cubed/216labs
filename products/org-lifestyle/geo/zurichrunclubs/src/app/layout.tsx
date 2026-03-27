import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zurich Run Clubs",
  description: "Concise weekly timetable for run clubs in Zurich with source-of-truth links.",
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
        {children}
      </body>
    </html>
  );
}
