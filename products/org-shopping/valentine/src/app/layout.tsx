import type { Metadata } from "next";
import "./globals.css";
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: "HeartInk — AI Valentine's Cards",
  description:
    "Turn a simple idea into a beautiful printed Valentine's card. AI writes the message and illustrates the cover.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-heart-cream font-body antialiased text-heart-ink">
        <Ga4Script />
        {children}
      </body>
    </html>
  );
}
