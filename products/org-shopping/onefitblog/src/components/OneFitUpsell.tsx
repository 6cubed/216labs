const ONEFIT_URL = 'https://onefit.6cubed.app'

/** Slim strip — good under the site header on every page */
export function OneFitUpsellStrip() {
  return (
    <div className="border-b border-[var(--surface)] bg-[#141011]">
      <div className="max-w-3xl mx-auto px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
        <p className="text-[var(--text)]">
          <span className="text-[var(--accent)] font-medium">Try OneFit</span>
          <span className="text-[var(--muted)]"> — upload a photo, get AI outfit ideas &amp; DALL-E visualisations</span>
        </p>
        <a
          href={ONEFIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#0c0a0c] hover:brightness-110 transition-[filter]"
        >
          Open OneFit
        </a>
      </div>
    </div>
  )
}

/** Card — homepage hero-adjacent or end of article */
export function OneFitUpsellCard({ variant = 'default' as 'default' | 'compact' }) {
  const pad = variant === 'compact' ? 'p-5' : 'p-6 sm:p-8'
  return (
    <aside
      className={`rounded-2xl border border-[var(--accent-dim)]/40 bg-gradient-to-br from-[#1a1215] to-[#140f11] ${pad} shadow-lg shadow-black/20`}
      aria-labelledby="onefit-cta-heading"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-2">From the same studio</p>
      <h2 id="onefit-cta-heading" className="text-lg sm:text-xl font-semibold text-[var(--text)] leading-snug">
        Turn these ideas into your own looks
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
        <strong className="text-[var(--text)] font-medium">OneFit</strong> is the AI personal stylist: analyse your
        wardrobe photos, get tailored recommendations, and see outfits rendered on AI-generated full-body images — so
        you can iterate faster than flat mood boards alone.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
        <li className="flex gap-2">
          <span className="text-[var(--accent)]" aria-hidden>
            ✓
          </span>
          GPT-4o Vision reads what you are wearing today
        </li>
        <li className="flex gap-2">
          <span className="text-[var(--accent)]" aria-hidden>
            ✓
          </span>
          DALL-E 3 visualises complete outfits before you buy or dress
        </li>
        <li className="flex gap-2">
          <span className="text-[var(--accent)]" aria-hidden>
            ✓
          </span>
          Same colour logic you read here — applied to your photos
        </li>
      </ul>
      <div className="mt-6">
        <a
          href={ONEFIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#0c0a0c] hover:brightness-110 transition-[filter]"
        >
          Start with OneFit
        </a>
      </div>
    </aside>
  )
}

/** Minimal footer line for layout */
export function OneFitFooterPitch() {
  return (
    <footer className="border-t border-[var(--surface)] mt-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 text-center text-xs text-[var(--muted)]">
        <p>
          Editorial from the OneFit project.{' '}
          <a
            href={ONEFIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline font-medium"
          >
            Try the OneFit AI stylist →
          </a>
        </p>
      </div>
    </footer>
  )
}
