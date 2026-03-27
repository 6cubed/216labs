import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Euromaxxers",
  description:
    "A curated explorer of world-class euromaxxers with Wikipedia links, cross-page relationships, and a transparent score.",
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
        {children}
      </body>
    </html>
  );
}
