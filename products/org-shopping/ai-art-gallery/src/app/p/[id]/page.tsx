import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyButton } from "@/components/BuyButton";
import { getPrint, priceForPrint } from "@/lib/catalog";

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const print = getPrint(id);
  if (!print) {
    return { title: "Piece not found — Frame & Flux" };
  }
  const title = `${print.title} — Frame & Flux`;
  const description = `${print.subtitle}. ${print.medium}. ${print.dimensions}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: print.imageSrc, alt: print.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [print.imageSrc],
    },
  };
}

export default async function PiecePage({ params }: Props) {
  const { id } = await params;
  const print = getPrint(id);
  if (!print) {
    notFound();
  }
  const cents = priceForPrint(print);

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink/10 bg-paper/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted mb-1">216Labs · Frame & Flux</p>
          <Link href="/" className="text-sm text-muted hover:text-ink underline">
            ← Full collection
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12">
        <div className="relative aspect-[4/3] bg-ink/5 rounded-2xl overflow-hidden border border-ink/10 shadow-sm">
          <img
            src={print.imageSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
          />
        </div>

        <div className="mt-8">
          <h1 className="font-display text-3xl md:text-4xl text-ink">{print.title}</h1>
          <p className="text-sm text-muted mt-2">{print.subtitle}</p>
          <p className="text-xs text-muted mt-4">
            {print.medium} · {print.dimensions}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xl font-semibold text-ink">{formatUsd(cents)}</p>
            <BuyButton printId={print.id} label="Ship it to me" />
          </div>
        </div>
      </article>

      <footer className="border-t border-ink/10 mt-16 py-10 text-center text-xs text-muted">
        <p>
          <Link href="https://216labs.com" className="underline hover:text-ink">
            216Labs
          </Link>
        </p>
      </footer>
    </main>
  );
}
