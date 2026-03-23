'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Submission {
  id: string
  lat: number
  lng: number
  caption: string
  filename: string
  createdAt: string
}

export default function BrowsePage() {
  const [list, setList] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/submissions')
      .then((r) => r.json())
      .then(setList)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-amber-500 hover:text-amber-400 text-sm">
          ← World Photo
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Submissions</h1>
      <p className="text-zinc-500 text-sm mb-6">
        Anonymous images tied to locations. Ground truth at scale.
      </p>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-zinc-500">No submissions yet. Be the first to submit.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((s) => (
            <div
              key={s.id}
              className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50"
            >
              <a href={`/api/image/${s.filename}`} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-zinc-800">
                <img
                  src={`/api/image/${s.filename}`}
                  alt={s.caption || 'Submission'}
                  className="w-full h-full object-cover"
                />
              </a>
              <div className="p-3">
                <p className="text-xs text-amber-500 font-mono">
                  {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                </p>
                {s.caption && (
                  <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{s.caption}</p>
                )}
                <p className="text-xs text-zinc-600 mt-1">
                  {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
