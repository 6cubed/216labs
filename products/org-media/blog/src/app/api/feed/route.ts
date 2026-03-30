import { NextResponse } from 'next/server'
import { posts } from '@/lib/posts'

/** Public JSON for the homepage and other consumers (latest posts, canonical URLs). */
export const dynamic = 'force-static'

function publicBase(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (u) return u.replace(/\/$/, '')
  const host = process.env.NEXT_PUBLIC_APP_HOST?.trim()
  if (host) return `https://blog.${host}`
  return 'https://blog.6cubed.app'
}

export function GET() {
  const base = publicBase()
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date))
  const items = sorted.slice(0, 10).map((p) => ({
    title: p.title,
    excerpt: p.excerpt,
    date: p.date,
    url: `${base}/blog/${p.slug}`,
  }))
  return NextResponse.json({ items, source: '216labs-blog' })
}
