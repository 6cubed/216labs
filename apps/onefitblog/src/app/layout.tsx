import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OneFit Fashion Journal',
  description:
    'Fashion tips and colour principles from the OneFit project — illustrated with AI-inspired outfit figures.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)]">{children}</body>
    </html>
  )
}
