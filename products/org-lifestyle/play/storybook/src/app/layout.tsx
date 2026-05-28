import type { Metadata } from "next";
import "./globals.css";
import { Ga4Script } from "@/components/ga4/Ga4Script";
import { ClientErrorReporter } from "@216labs/errors/react";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://storybook.6cubed.app";

export const metadata: Metadata = {
  title: "StoryMagic — AI Children's Storybooks",
  description:
    "Create a personalised, illustrated children's storybook in minutes. Preview free — join the waitlist for printed copies.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "StoryMagic — A storybook starring your child",
    description:
      "Type a topic, watch AI illustrate every page, then reserve a hardback print. Perfect gift for ages 3–10.",
    url: siteUrl,
    siteName: "StoryMagic",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "StoryMagic" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StoryMagic — AI children's storybooks",
    description:
      "Personalised illustrated storybooks in minutes. Preview free on storybook.6cubed.app.",
    images: ["/og.svg"],
  },
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
        <ClientErrorReporter appId="storybook" />
        {children}
      </body>
    </html>
  );
}
