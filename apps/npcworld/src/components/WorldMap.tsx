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
  speech?: string
}

type Props = {
  players: MapPlayer[]
  selfId: string | null
}

export default function WorldMap({ players, selfId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)

  useEffect(() => {
    let disposed = false
    async function initMap() {
      if (!containerRef.current || mapRef.current) return
      const L = await import('leaflet')
      if (disposed || !containerRef.current) return

      const map = L.map(containerRef.current, {
        zoomControl: true,
      }).setView([47.3769, 8.5417], 12)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      const layer = L.layerGroup().addTo(map)
      mapRef.current = map
      layerRef.current = layer
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
        const marker = L.circleMarker([player.lat, player.lng], {
          radius: isSelf ? 10 : 8,
          color,
          fillColor: color,
          fillOpacity: 0.8,
          weight: 2,
        })
        const speech = player.speech ? `<br/><em>${player.speech}</em>` : ''
        marker.bindPopup(
          `<strong>${player.name}</strong><br/>HP ${player.hp} | ST ${player.stamina}<br/>${player.lastAction}${speech}`
        )
        marker.addTo(layer)
      }
    }
    redraw()
  }, [players, selfId])

  return <div ref={containerRef} style={{ width: '100%', height: 520, borderRadius: 12, overflow: 'hidden' }} />
}
