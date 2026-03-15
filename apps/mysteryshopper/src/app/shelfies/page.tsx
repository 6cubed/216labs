import Link from 'next/link'
import { getShelfies } from '@/lib/store'

export default async function ShelfiesPage() {
  const shelfies = await getShelfies()
  const uploadsBase = '/api/uploads'

  return (
    <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-emerald-500 hover:text-emerald-400 text-sm">
          ← Mystery Shopper
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Shelfies</h1>
      <p className="text-zinc-500 text-sm mb-6">
        All captures with store context. Ground truth fleet.
      </p>

      {shelfies.length === 0 ? (
        <p className="text-zinc-500">No shelfies yet. Capture one from the store you’re in.</p>
      ) : (
        <ul className="space-y-6">
          {shelfies.map((s) => (
            <li key={s.id} className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50">
              <img
                src={`${uploadsBase}/${s.filename}`}
                alt={s.caption || 'Shelfie'}
                className="w-full aspect-video object-cover"
              />
              <div className="p-3">
                <p className="font-medium text-zinc-200">{s.storeName}</p>
                {s.caption && <p className="text-sm text-zinc-500 mt-0.5">{s.caption}</p>}
                <p className="text-xs text-zinc-600 mt-1">{new Date(s.createdAt).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
