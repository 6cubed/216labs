'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { MapPlayer } from './WorldMap'

const WorldMap = dynamic(() => import('./WorldMap'), { ssr: false })

type Props = {
  players: MapPlayer[]
  selfId: string | null
  lat: number
  lng: number
  heading: number
}

/**
 * Primary: Google Street View embed (needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY at build time).
 * Fallback: Leaflet at street-level zoom when no key or for local dev.
 */
export default function StreetViewPane({ players, selfId, lat, lng, heading }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const src = useMemo(() => {
    if (!apiKey) return ''
    const h = ((Math.round(heading) % 360) + 360) % 360
    const q = new URLSearchParams({
      key: apiKey,
      location: `${lat},${lng}`,
      heading: String(h),
      pitch: '0',
      fov: '80',
    })
    return `https://www.google.com/maps/embed/v1/streetview?${q.toString()}`
  }, [apiKey, lat, lng, heading])

  if (!apiKey) {
    return (
      <div className="npc-street-wrap">
        <WorldMap players={players} selfId={selfId} mode="street" />
        <p className="npc-street-hint">
          Street View mode: set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> (Maps Embed API) for live panoramas.
          Showing street-level map until then.
        </p>
      </div>
    )
  }

  return (
    <div className="npc-street-wrap">
      <iframe
        title="Street view"
        className="npc-street-iframe"
        src={src}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="npc-street-hint">
        Street View — no coverage in some areas; panorama may be unavailable or jump.
      </p>
    </div>
  )
}
