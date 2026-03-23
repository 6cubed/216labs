import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-xl text-center space-y-8">
        <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
          World Photo
        </h1>
        <p className="text-zinc-400 leading-relaxed">
          A crowdsourced initiative for <strong className="text-zinc-300">anonymous</strong> submission of
          images tied to locations — to unlock <strong className="text-zinc-300">ground truth at scale</strong>,
          particularly during war times. Your submission is not attributed; the place and the moment are what matter.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/submit"
            className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
          >
            Submit a photo
          </Link>
          <Link
            href="/browse"
            className="px-5 py-2.5 rounded-lg border border-zinc-600 hover:border-zinc-500 text-zinc-300 font-medium transition-colors"
          >
            Browse submissions
          </Link>
        </div>
      </div>
    </div>
  )
}
