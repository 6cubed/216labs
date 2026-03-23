'use client'

import { useEffect, useRef } from 'react'

export type MapPlayer = {
  id: string
  name: string
  lat: number
  lng: number
  hp: number
  stamina: number
  lastAction: string
  actionText?: string
  mood?: string
  emote?: string
  heading?: number
  speech?: string
}

type Props = {
  players: MapPlayer[]
  selfId: string | null
  /** When `street`, use tighter zoom and keep following the local player (Leaflet fallback for Street View). */
  mode?: 'default' | 'street'
}

export default function WorldMap({ players, selfId, mode = 'default' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)
  const hasFocusedSelfRef = useRef(false)
  const street = mode === 'street'

  useEffect(() => {
    let disposed = false
    async function initMap() {
      if (!containerRef.current || mapRef.current) return
      const L = await import('leaflet')
      if (disposed || !containerRef.current) return

      const zoom = street ? 18 : 17
      const map = L.map(containerRef.current, {
        zoomControl: true,
      }).setView([47.3769, 8.5417], zoom)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      const layer = L.layerGroup().addTo(map)
      mapRef.current = map
      layerRef.current = layer
      window.setTimeout(() => map.invalidateSize(), 120)
    }

    initMap()
    return () => {
      disposed = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        layerRef.current = null
      }
    }
  }, [street])

  useEffect(() => {
    if (!mapRef.current) return
    const onResize = () => mapRef.current?.invalidateSize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    async function redraw() {
      if (!layerRef.current) return
      const L = await import('leaflet')
      const layer = layerRef.current
      layer.clearLayers()

      for (const player of players) {
        const isSelf = player.id === selfId
        const color = isSelf ? '#38bdf8' : '#fb7185'
        const heading = Number.isFinite(player.heading) ? player.heading : 0
        const marker = L.marker([player.lat, player.lng], {
          icon: L.divIcon({
            className: '',
            html: `
              <div class="npc-marker ${isSelf ? 'self' : 'other'}" style="--npc-color:${color}; --npc-heading:${heading}deg;">
                <div class="npc-marker-pulse"></div>
                <div class="npc-marker-body">${isSelf ? '🧍' : '🕴️'}</div>
                <div class="npc-marker-arrow">▲</div>
                ${player.emote ? `<div class="npc-marker-emote">${player.emote}</div>` : ''}
              </div>
            `,
            iconSize: [40, 46],
            iconAnchor: [20, 34],
          }),
        })
        const speech = player.speech ? `<br/><em>${player.speech}</em>` : ''
        marker.bindPopup(
          `<strong>${player.name}</strong><br/>HP ${player.hp} | ST ${player.stamina}<br/>${player.actionText || player.lastAction} (${player.mood || 'steady'})${speech}`
        )
        marker.addTo(layer)
      }

      if (!mapRef.current || !selfId) return
      const me = players.find((p) => p.id === selfId)
      if (!me) return

      if (street) {
        mapRef.current.setView([me.lat, me.lng], 18, { animate: true })
        mapRef.current.invalidateSize()
      } else if (!hasFocusedSelfRef.current) {
        mapRef.current.setView([me.lat, me.lng], 17, { animate: false })
        hasFocusedSelfRef.current = true
      }
    }
    redraw()
  }, [players, selfId, street])

  return <div ref={containerRef} className={street ? 'npc-map-host' : 'npc-map'} />
}
