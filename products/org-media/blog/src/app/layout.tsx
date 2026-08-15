import type { Metadata } from 'next'
import './globals.css'
import { ClientErrorReporter } from "@216labs/errors/react";
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: '216Labs Blog',
  description:
    'From the slop, structure will emerge. Essays on shipping, audio/ML, and the factory behind the toolkit.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <Ga4Script />
        <ClientErrorReporter appId="blog" />
        {children}</body>
    </html>
  )
}
