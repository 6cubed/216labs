import './globals.css'
import 'leaflet/dist/leaflet.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: 'NPCWorld',
  description: 'Browser-native LLM NPCs roaming a shared real-world map.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Ga4Script />
        {children}</body>
    </html>
  )
}
