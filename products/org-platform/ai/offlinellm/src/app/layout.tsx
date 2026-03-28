import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: "OfflineLLM — Your LLM for the next flight",
  description:
    "Download a model once, then use a full LLM in your browser entirely offline. Perfect for flights and no-signal spots.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-[100dvh]">
        <Ga4Script />
        {children}</body>
    </html>
  );
}
