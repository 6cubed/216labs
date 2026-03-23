import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-xl text-center space-y-8">
        <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
          Mystery Shopper
        </h1>
        <p className="text-zinc-400 leading-relaxed">
          A <strong className="text-zinc-300">ground truth fleet</strong> platform: set the store you’re in, then capture
          <strong className="text-zinc-300"> shelfies</strong> — shelf photos tied to that store. Every capture knows its location.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/capture"
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            Capture a shelfie
          </Link>
          <Link
            href="/shelfies"
            className="px-5 py-2.5 rounded-lg border border-zinc-600 hover:border-zinc-500 text-zinc-300 font-medium transition-colors"
          >
            View shelfies
          </Link>
        </div>
      </div>
    </div>
  )
}
