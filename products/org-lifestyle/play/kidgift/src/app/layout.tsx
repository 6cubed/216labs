import type { Metadata } from "next";
import { ClientErrorReporter } from "@216labs/errors/react";
import { Ga4Script } from "@/components/ga4/Ga4Script";
import "./globals.css";

export const metadata: Metadata = {
  title: "KidGift — AI gift ideas for kids",
  description:
    "Find thoughtful gift ideas by age and interests. Curated picks instantly; optional AI. The premium pick: a StoryMagic book starring your child.",
  openGraph: {
    title: "KidGift — gift ideas for kids",
    description: "Age + interests → gift ideas in seconds. Upsells StoryMagic personalised storybooks.",
    url: "https://kidgift.6cubed.app",
    siteName: "KidGift",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Ga4Script />
        <ClientErrorReporter appId="kidgift" />
        {children}
      </body>
    </html>
  );
}
