import type { Metadata } from 'next'
import './globals.css'
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: '216Labs Blog',
  description:
    'At 216Labs we are building the toolkit for production grade vibes. Essays on vibe coding, tooling, and how we ship.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <Ga4Script />
        {children}</body>
    </html>
  )
}
