import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '216labs Blog',
  description: 'The blog of the 216labs project — vibe coding, tooling, and the ecosystem we build.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)]">{children}</body>
    </html>
  )
}
