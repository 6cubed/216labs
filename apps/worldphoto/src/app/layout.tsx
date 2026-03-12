import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'World Photo — Ground truth at scale',
  description: 'Crowdsourced anonymous images tied to locations. Unlock ground truth at scale, particularly during war times.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
