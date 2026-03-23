import Link from 'next/link'
import { posts } from '@/lib/posts'
import { OneFitUpsellCard } from '@/components/OneFitUpsell'

export default function HomePage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <header className="mb-8">
        <Link href="/" className="text-xl font-semibold text-[var(--accent)] hover:underline">
          OneFit Fashion Journal
        </Link>
        <p className="text-[var(--muted)] text-sm mt-1">
          Fashion tips with genAI outfit ideas — the editorial arm of{' '}
          <a
            href="https://onefit.6cubed.app"
            className="text-[var(--accent)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            OneFit
          </a>
          , your AI stylist.
        </p>
      </header>

      <div className="mb-12">
        <OneFitUpsellCard variant="compact" />
      </div>

      <main className="space-y-10">
        {posts.map((post) => (
          <article key={post.slug} className="border-b border-[var(--surface)] pb-10 last:border-0">
            <Link href={`/blog/${post.slug}`} className="group block">
              <time className="text-xs text-[var(--muted)]" dateTime={post.date}>
                {new Date(post.date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                {post.title}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{post.excerpt}</p>
            </Link>
          </article>
        ))}
      </main>
    </div>
  )
}
