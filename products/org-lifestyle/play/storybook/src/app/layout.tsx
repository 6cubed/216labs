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
    "Create a personalised, illustrated children's storybook. Preview free — printed hardcover $24.99 (preorder via Payment Link or waitlist).",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "StoryMagic — A storybook starring your child ($24.99 hardcover)",
    description:
      "Type a topic, watch AI illustrate every page, then preorder or join the waitlist for a premium hardback. Ages 3–10.",
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
      "Personalised illustrated storybooks — preview free, $24.99 hardcover preorder on storybook.6cubed.app.",
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
