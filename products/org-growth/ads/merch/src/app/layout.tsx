import type { Metadata } from "next"
import "./globals.css"

const site =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://merch.6cubed.app"

export const metadata: Metadata = {
  title: "Merch — 6cubed × 216Labs",
  description:
    "Official branded apparel, accessories, and stationery for fans of 6cubed and 216Labs. Tees, hoodies, caps, stickers, and more.",
  metadataBase: new URL(site),
  openGraph: {
    title: "Merch — 6cubed × 216Labs",
    description: "Official gear for fans and builders.",
    url: site,
    siteName: "6cubed Merch",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen mesh-bg text-[var(--text)]">{children}</body>
    </html>
  )
}
