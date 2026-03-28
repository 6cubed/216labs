import type { Metadata } from "next";
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: "Euromaxxers | Wikipedia Network Explorer",
  description:
    "Investor-ready explorer of euromaxxer profiles with Wikipedia-powered relationship discovery, transparent scoring, and browseable network views.",
  metadataBase: new URL("https://euromaxxers.6cubed.app"),
  openGraph: {
    title: "Euromaxxers",
    description:
      "Browse euromaxxer profiles, discover Wikipedia-connected candidates, and map relationship networks.",
    url: "https://euromaxxers.6cubed.app",
    siteName: "Euromaxxers",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          margin: 0,
          background: "#0b1020",
          color: "#f4f7ff",
        }}
      >
        <Ga4Script />
        {children}
      </body>
    </html>
  );
}
