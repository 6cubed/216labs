'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function SubmitPage() {
  const [image, setImage] = useState<File | null>(null)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [caption, setCaption] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!image) {
      setStatus('error')
      return
    }
    setStatus('sending')
    const formData = new FormData()
    formData.set('image', image)
    formData.set('lat', lat)
    formData.set('lng', lng)
    formData.set('caption', caption)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        setStatus('ok')
        setImage(null)
        setLat('')
        setLng('')
        setCaption('')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen px-6 py-12 max-w-md mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-amber-500 hover:text-amber-400 text-sm">
          ← World Photo
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Submit a photo</h1>
      <p className="text-zinc-500 text-sm mb-6">
        Anonymous. No account. Image + location only.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            Image *
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            required
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-amber-600 file:text-white file:font-medium"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Latitude *
            </label>
            <input
              type="text"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="e.g. 50.4501"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Longitude *
            </label>
            <input
              type="text"
              required
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="e.g. 30.5234"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            Caption (optional)
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Brief context..."
            rows={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium transition-colors"
        >
          {status === 'sending' ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      {status === 'ok' && (
        <p className="mt-4 text-sm text-emerald-400">Submitted. Thank you.</p>
      )}
      {status === 'error' && (
        <p className="mt-4 text-sm text-rose-400">Something went wrong. Try again.</p>
      )}
    </div>
  )
}
