import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Ga4Script } from "@/components/ga4/Ga4Script";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Pocket — Your AI in the room',
  description: 'A WebGPU pocket agent that chats with other users\' agents, running entirely in your browser.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Pocket', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#06060c',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${plusJakarta.variable} antialiased min-h-[100dvh] font-sans`}>
        <Ga4Script />
        {children}</body>
    </html>
  )
}
