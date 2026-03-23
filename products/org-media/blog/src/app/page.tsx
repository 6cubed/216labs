import Link from 'next/link'
import { posts } from '@/lib/posts'

export default function HomePage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <header className="mb-12">
        <Link href="/" className="text-xl font-semibold text-[var(--accent)] hover:underline">
          216labs blog
        </Link>
        <p className="text-[var(--muted)] text-sm mt-1">
          The blog of the 216labs project
        </p>
      </header>

      <main className="space-y-10">
        {posts.map((post) => (
          <article key={post.slug} className="border-b border-[var(--surface)] pb-10 last:border-0">
            <Link href={`/blog/${post.slug}`} className="group block">
              <time className="text-xs text-[var(--muted)]" dateTime={post.date}>
                {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </time>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                {post.title}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
                {post.excerpt}
              </p>
            </Link>
          </article>
        ))}
      </main>
    </div>
  )
}
