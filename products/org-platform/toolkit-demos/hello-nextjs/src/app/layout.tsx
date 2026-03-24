import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hello Next.js — toolkit demo",
  description: "Minimal Next.js service in the production-grade vibes toolkit monorepo.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "2rem", lineHeight: 1.5 }}>
        {children}
      </body>
    </html>
  );
}
