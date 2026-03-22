import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tigertank',
  description:
    'Speculative essays on society and systems from 216labs — a thinktank alongside the main blog.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)]">{children}</body>
    </html>
  )
}
