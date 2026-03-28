import type { Metadata } from 'next'
import './globals.css'
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: 'Mystery Shopper — Ground truth fleet',
  description: 'Know the store you\'re in. Capture shelfies from that store. Ground truth at scale.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Ga4Script />
        {children}</body>
    </html>
  )
}
