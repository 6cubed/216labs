'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CapturePage() {
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [newStoreName, setNewStoreName] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [loadingStores, setLoadingStores] = useState(true)

  useEffect(() => {
    fetch('/api/stores')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.stores)) setStores(data.stores)
        setLoadingStores(false)
      })
      .catch(() => setLoadingStores(false))
  }, [])

  async function handleAddStore(e: React.FormEvent) {
    e.preventDefault()
    const name = newStoreName.trim()
    if (!name) return
    setErrorMessage('')
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.store) {
        setStores((prev) => [...prev, { id: data.store.id, name: data.store.name }])
        setSelectedStoreId(data.store.id)
        setNewStoreName('')
      } else {
        setErrorMessage(data.error || 'Could not add store')
      }
    } catch {
      setErrorMessage('Could not add store')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const storeId = selectedStoreId || newStoreName.trim()
    if (!storeId) {
      setStatus('error')
      setErrorMessage('Select a store or enter a new store name.')
      return
    }
    if (!image) {
      setStatus('error')
      setErrorMessage('Please select a photo.')
      return
    }
    setStatus('sending')
    setErrorMessage('')
    const formData = new FormData()
    formData.set('image', image)
    formData.set('storeId', storeId)
    formData.set('caption', caption)
    try {
      const res = await fetch('/api/submit', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus('ok')
        setImage(null)
        setCaption('')
      } else {
        setStatus('error')
        setErrorMessage(data.error || 'Something went wrong.')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Something went wrong.')
    }
  }

  const hasStore = !!(selectedStoreId || newStoreName.trim())

  return (
    <div className="min-h-screen px-6 py-12 max-w-md mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-emerald-500 hover:text-emerald-400 text-sm">
          ← Mystery Shopper
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Capture a shelfie</h1>
      <p className="text-zinc-500 text-sm mb-6">
        Set the store you’re in, then add a photo. Every shelfie is tied to that store for ground truth.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">Store you’re in *</label>
          {loadingStores ? (
            <p className="text-zinc-500 text-sm">Loading stores…</p>
          ) : (
            <>
              <select
                value={selectedStoreId}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value)
                  setNewStoreName('')
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="">— Choose or add below —</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-600 mt-1">Or add a new store:</p>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={newStoreName}
                  onChange={(e) => {
                    setNewStoreName(e.target.value)
                    if (e.target.value.trim()) setSelectedStoreId('')
                  }}
                  placeholder="e.g. Tesco Oxford St"
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddStore}
                  disabled={!newStoreName.trim()}
                  className="px-3 py-2 rounded-lg border border-emerald-600 text-emerald-500 hover:bg-emerald-600/10 disabled:opacity-50 text-sm font-medium"
                >
                  Add
                </button>
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">Shelf photo *</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-emerald-600 file:text-white file:font-medium"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">Caption (optional)</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Cereal aisle, end cap"
            rows={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'sending' || !hasStore || !image}
          className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium transition-colors"
        >
          {status === 'sending' ? 'Saving…' : 'Save shelfie'}
        </button>
      </form>

      {status === 'ok' && (
        <p className="mt-4 text-sm text-emerald-400">Shelfie saved. It’s tied to this store.</p>
      )}
      {(status === 'error' || errorMessage) && (
        <p className="mt-4 text-sm text-rose-400">{errorMessage || 'Something went wrong. Try again.'}</p>
      )}
    </div>
  )
}
