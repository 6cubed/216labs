'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function SubmitPage() {
  const [image, setImage] = useState<File | null>(null)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [caption, setCaption] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)

  function useMyLocation() {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation not supported by this browser.')
      return
    }
    setLocationLoading(true)
    setErrorMessage('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude))
        setLng(String(pos.coords.longitude))
        setLocationLoading(false)
      },
      () => {
        setErrorMessage('Could not get location. Enable location access or enter coordinates.')
        setLocationLoading(false)
      }
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!image) {
      setStatus('error')
      setErrorMessage('Please select a photo.')
      return
    }
    setStatus('sending')
    setErrorMessage('')
    const formData = new FormData()
    formData.set('image', image)
    formData.set('caption', caption)
    if (lat.trim()) formData.set('lat', lat.trim())
    if (lng.trim()) formData.set('lng', lng.trim())
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus('ok')
        setImage(null)
        setLat('')
        setLng('')
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

  return (
    <div className="min-h-screen px-6 py-12 max-w-md mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-amber-500 hover:text-amber-400 text-sm">
          ← World Photo
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Submit a photo</h1>
      <p className="text-zinc-500 text-sm mb-6">
        Anonymous. Location comes from the photo’s GPS (if present) or from your device.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            Photo *
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            required
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-amber-600 file:text-white file:font-medium"
          />
          <p className="text-xs text-zinc-600 mt-1">
            Many phone photos include GPS. We’ll use it if present.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            Location
          </label>
          <p className="text-xs text-zinc-500 mb-2">
            Optional if the photo has GPS. Or share your current location:
          </p>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locationLoading}
            className="mb-3 w-full py-2.5 rounded-lg border border-amber-600 text-amber-500 hover:bg-amber-600/10 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {locationLoading ? 'Getting location…' : 'Use my location'}
          </button>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="Latitude (optional)"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="Longitude (optional)"
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
      {(status === 'error' || errorMessage) && (
        <p className="mt-4 text-sm text-rose-400">{errorMessage || 'Something went wrong. Try again.'}</p>
      )}
    </div>
  )
}
