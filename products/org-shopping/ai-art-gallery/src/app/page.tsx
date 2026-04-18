import Link from "next/link";
import { BuyButton } from "@/components/BuyButton";
import { PRINTS, priceForPrint } from "@/lib/catalog";

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function GalleryPage({
  searchParams,
}: {
  searchParams: { cancelled?: string };
}) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-ink/10 bg-paper/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted mb-1">216Labs</p>
            <h1 className="font-display text-3xl md:text-4xl text-ink">Frame & Flux</h1>
            <p className="text-sm text-muted mt-2 max-w-xl">
              AI-assisted limited prints, produced as physical giclée pieces. Pay with Stripe; we ship
              to the address you enter at checkout.
            </p>
          </div>
        </div>
      </header>

      {searchParams.cancelled ? (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 inline-block">
            Checkout cancelled — your cart was not charged.
          </p>
        </div>
      ) : null}

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="font-display text-2xl text-ink mb-8">Collection</h2>
        <div className="grid sm:grid-cols-2 gap-10 lg:gap-12">
          {PRINTS.map((p) => {
            const cents = priceForPrint(p);
            return (
              <article
                key={p.id}
                className="group border border-ink/10 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-[4/3] bg-ink/5">
                  <img
                    src={p.imageSrc}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading={p.id === "nebula-stitch" ? "eager" : "lazy"}
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-display text-xl text-ink">{p.title}</h3>
                  <p className="text-sm text-muted mt-1">{p.subtitle}</p>
                  <p className="text-xs text-muted mt-3">
                    {p.medium} · {p.dimensions}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-lg font-semibold text-ink">{formatUsd(cents)}</p>
                    <BuyButton printId={p.id} label="Ship it to me" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-ink/10 mt-16 py-10 text-center text-xs text-muted">
        <p>
          Questions?{" "}
          <a href="mailto:hello@216labs.com" className="underline hover:text-ink">
            hello@216labs.com
          </a>
        </p>
        <p className="mt-2">
          <Link href="https://216labs.com" className="underline hover:text-ink">
            216Labs
          </Link>
        </p>
      </footer>
    </main>
  );
}
