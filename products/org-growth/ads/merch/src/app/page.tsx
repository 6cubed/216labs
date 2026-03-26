import { categoryLabel, products, type MerchProduct } from "@/data/products"

function CubeMark({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border border-white/10 bg-[var(--surface)] px-2 py-1 text-sm font-semibold tracking-tight ${className ?? ""}`}
      aria-hidden
    >
      <span className="bg-clip-text text-transparent bg-gradient-to-br from-cyan-300 via-fuchsia-400 to-pink-400">
        6³
      </span>
    </span>
  )
}

function Badge({ kind }: { kind: NonNullable<MerchProduct["badge"]> }) {
  const label = kind === "new" ? "New" : "Limited"
  const cls =
    kind === "new"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35"
      : "bg-amber-500/15 text-amber-200 border-amber-500/35"
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}
    >
      {label}
    </span>
  )
}

function ProductVisual({ id, name }: { id: string; name: string }) {
  const hues = [
    "from-cyan-500/20 via-fuchsia-500/10 to-pink-500/15",
    "from-violet-500/20 via-cyan-500/10 to-emerald-500/10",
    "from-fuchsia-500/15 via-pink-500/10 to-amber-500/10",
    "from-emerald-500/15 via-cyan-500/10 to-violet-500/15",
  ]
  const idx =
    id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length
  return (
    <div
      className={`relative aspect-[4/3] rounded-lg bg-gradient-to-br ${hues[idx]} border border-white/5 overflow-hidden`}
      aria-hidden
    >
      <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <p className="text-center text-xs font-medium text-zinc-500/90 leading-snug max-w-[12rem]">
          {name}
        </p>
      </div>
    </div>
  )
}

function resolvePurchaseHref(product: MerchProduct): string | null {
  if (product.purchaseUrl) return product.purchaseUrl
  const base = process.env.NEXT_PUBLIC_MERCH_STORE_URL?.trim()
  if (!base) return null
  try {
    const u = new URL(base)
    u.searchParams.set("product", product.id)
    return u.toString()
  } catch {
    return null
  }
}

export default function MerchPage() {
  const defaultStore = process.env.NEXT_PUBLIC_MERCH_STORE_URL?.trim()

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
      <header className="mb-12 sm:mb-16 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
          <CubeMark />
          <span className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]">
            Official store
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-balance">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-pink-200">
            6cubed
          </span>
          <span className="text-zinc-500 mx-2 sm:mx-3 font-light">×</span>
          <span className="text-zinc-100">216Labs</span>
        </h1>
        <p className="mt-4 text-[var(--muted)] text-base sm:text-lg max-w-2xl leading-relaxed">
          Tees, hoodies, caps, stickers, and small goods — built for fans of the project and anyone who
          ships production-grade vibes.
        </p>
        <p className="mt-3 text-sm text-zinc-500 max-w-2xl">
          New drops and limited runs show up here first. When checkout is wired to our storefront partner,
          use <strong className="text-zinc-400 font-medium">Buy</strong> to complete your order securely.
        </p>
      </header>

      <section aria-label="Product catalog" className="mb-16">
        <h2 className="sr-only">Products</h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {products.map((p) => {
            const href = resolvePurchaseHref(p)
            return (
              <li key={p.id}>
                <article className="group h-full flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.03)] hover:border-cyan-500/25 transition-colors">
                  <ProductVisual id={p.id} name={p.name} />
                  <div className="p-5 flex flex-col flex-1 gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 border border-zinc-700/80 rounded-full px-2 py-0.5">
                        {categoryLabel[p.category]}
                      </span>
                      {p.badge ? <Badge kind={p.badge} /> : null}
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-100 leading-snug">{p.name}</h3>
                    <p className="text-sm text-[var(--muted)] leading-relaxed flex-1">{p.tagline}</p>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[var(--border)]">
                      <span className="text-sm tabular-nums text-zinc-300">From {p.priceFrom}</span>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-600/90 to-fuchsia-600/90 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-500 hover:to-fuchsia-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
                        >
                          Buy
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-500 italic">Checkout URL not configured</span>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-6 sm:p-8 mb-12">
        <h2 className="text-lg font-semibold text-zinc-100 mb-3">Wholesale &amp; custom runs</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed max-w-2xl">
          Need a batch for a meetup, conference, or team? Reach out through your usual 216Labs channel — we
          can coordinate larger orders and custom colorways when inventory partners allow.
        </p>
      </section>

      <footer className="border-t border-[var(--border)] pt-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between text-xs text-zinc-600">
        <p>
          © {new Date().getFullYear()} 216Labs ·{" "}
          <a className="text-zinc-500 hover:text-cyan-400/90" href="https://6cubed.app/">
            6cubed.app
          </a>
        </p>
        {defaultStore ? (
          <a
            href={defaultStore}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-fuchsia-300/90"
          >
            Open storefront →
          </a>
        ) : (
          <span className="text-zinc-600">Set NEXT_PUBLIC_MERCH_STORE_URL to enable default checkout.</span>
        )}
      </footer>
    </div>
  )
}
