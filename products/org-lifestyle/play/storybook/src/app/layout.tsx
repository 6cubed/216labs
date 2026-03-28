import type { Metadata } from "next";
import "./globals.css";
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: "StoryMagic — AI Children's Storybooks",
  description:
    "Create a personalised, illustrated children's storybook in minutes. Powered by AI. Order a professionally printed copy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-story-cream font-body antialiased">
        <Ga4Script />
        {children}
      </body>
    </html>
  );
}
