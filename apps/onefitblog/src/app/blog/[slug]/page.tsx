import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPostBySlug, getAllSlugs, type ContentBlock } from '@/lib/posts'
import { OutfitShowcase } from '@/components/OutfitShowcase'
import { OneFitUpsellCard } from '@/components/OneFitUpsell'

function renderBody(body: string) {
  return body.split(/\n\n+/).map((block, i) => {
    const trimmed = block.trim()
    if (!trimmed) return null
    const html = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    return <p key={i} className="mb-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
  })
}

function renderBlocks(blocks: ContentBlock[]) {
  return blocks.map((block, i) => {
    if (block.type === 'text') {
      return <div key={i}>{renderBody(block.text)}</div>
    }
    return <OutfitShowcase key={i} looks={block.looks} />
  })
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <header className="mb-10">
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
          ← OneFit Fashion Journal
        </Link>
        <time className="block text-xs text-[var(--muted)] mt-2" dateTime={post.date}>
          {new Date(post.date).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </time>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] leading-snug">{post.title}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Published by the OneFit team —{' '}
          <a
            href="https://onefit.6cubed.app"
            className="text-[var(--accent)] hover:underline font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            open the AI stylist app
          </a>{' '}
          to apply these ideas to your own photos.
        </p>
      </header>

      <div className="prose prose-invert prose-sm max-w-none text-[var(--text)]">
        {post.content ? renderBlocks(post.content) : post.body ? renderBody(post.body) : null}
      </div>

      <div className="mt-14 not-prose">
        <OneFitUpsellCard />
      </div>
    </div>
  )
}
