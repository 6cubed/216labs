import Link from 'next/link'
import { notFound } from 'next/navigation'
import { unstable_noStore } from 'next/cache'
import { getPostBySlug } from '@/lib/posts'

/** Route lives under /read (not /p) so Docker/GHCR layer merge cannot resurrect stale per-slug SSG files. */
export const dynamic = 'force-dynamic'
export const dynamicParams = true

function renderBody(body: string) {
  return body.split(/\n\n+/).map((block, i) => {
    const trimmed = block.trim()
    if (!trimmed) return null
    const html = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    return <p key={i} className="mb-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
  })
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  unstable_noStore()
  const { slug } = params
  const post = getPostBySlug(decodeURIComponent(slug))
  if (!post) notFound()

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <header className="mb-10">
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
          ← Tigertank
        </Link>
        <time className="block text-xs text-[var(--muted)] mt-2" dateTime={post.date}>
          {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </time>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)]">
          {post.title}
        </h1>
      </header>

      <div className="prose prose-invert prose-sm max-w-none text-[var(--text)]">
        {renderBody(post.body)}
      </div>
    </div>
  )
}
