import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Marketing hub — 216labs',
  description:
    'Overview of marketing campaigns across apps: dedicated blogs, newsletters, landings, and more.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)]">{children}</body>
    </html>
  )
}
