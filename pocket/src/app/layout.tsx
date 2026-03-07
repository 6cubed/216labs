import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pocket — Your AI in the room',
  description: 'A WebGPU pocket agent that chats with other users\' agents, running entirely in your browser.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  )
}
