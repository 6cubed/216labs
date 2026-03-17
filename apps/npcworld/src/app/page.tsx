'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MapPlayer } from '@/components/WorldMap'

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false })

type Scores = Record<'up' | 'down' | 'left' | 'right' | 'speak' | 'rest' | 'attack', number>
type Perception = { self: MapPlayer; nearby: MapPlayer[]; tick: number }

function defaultScores(): Scores {
  return { up: 0, down: 0, left: 0, right: 0, speak: 0, rest: 1, attack: 0 }
}

function heuristicScores(perception: Perception): { scores: Scores; utterance: string } {
  const scores = defaultScores()
  const nearby = perception.nearby
  const lowStamina = perception.self.stamina < 25
  if (lowStamina) {
    scores.rest = 1
    return { scores, utterance: '' }
  }
  if (nearby.length > 0) {
    scores.speak = 0.6
    scores.attack = perception.self.stamina > 40 ? 0.45 : 0.05
    const target = nearby[0]
    if (target.lat > perception.self.lat) scores.up = 0.7
    if (target.lat < perception.self.lat) scores.down = 0.7
    if (target.lng > perception.self.lng) scores.right = 0.7
    if (target.lng < perception.self.lng) scores.left = 0.7
    return { scores, utterance: `Watching ${target.name}.` }
  }
  const dirs: (keyof Scores)[] = ['up', 'down', 'left', 'right']
  scores[dirs[Math.floor(Math.random() * dirs.length)]] = 0.8
  scores.rest = 0.15
  return { scores, utterance: '' }
}

function parseScoringResponse(raw: string): { scores: Scores; utterance: string } | null {
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) return null
  try {
    const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1))
    const scores = defaultScores()
    const obj = parsed?.scores || {}
    ;(Object.keys(scores) as (keyof Scores)[]).forEach((k) => {
      const n = Number(obj[k])
      scores[k] = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
    })
    const utterance = typeof parsed?.utterance === 'string' ? parsed.utterance.slice(0, 120).trim() : ''
    return { scores, utterance }
  } catch {
    return null
  }
}

export default function NpcWorldPage() {
  const [name, setName] = useState('Wanderer')
  const [selfId, setSelfId] = useState<string | null>(null)
  const [players, setPlayers] = useState<MapPlayer[]>([])
  const [wsConnected, setWsConnected] = useState(false)
  const [perception, setPerception] = useState<Perception | null>(null)
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [loadProgress, setLoadProgress] = useState(0)
  const [autopilot, setAutopilot] = useState(true)
  const [lastInference, setLastInference] = useState('waiting for world state...')
  const wsRef = useRef<WebSocket | null>(null)
  const engineRef = useRef<any>(null)

  const selfPlayer = useMemo(() => players.find((p) => p.id === selfId) || null, [players, selfId])

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`)

    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onerror = () => setWsConnected(false)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'init') {
          setSelfId(msg.selfId)
          if (Array.isArray(msg.players)) setPlayers(msg.players)
          ws.send(JSON.stringify({ type: 'join', name }))
        } else if (msg.type === 'snapshot') {
          if (Array.isArray(msg.players)) setPlayers(msg.players)
        } else if (msg.type === 'perception') {
          setPerception(msg)
        }
      } catch {
        // ignore malformed websocket frames
      }
    }

    wsRef.current = ws
    return () => ws.close()
  }, [])

  const sendScores = useCallback((scores: Scores, utterance = '') => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== 1) return
    ws.send(JSON.stringify({ type: 'action_scores', scores, utterance }))
  }, [])

  const runLLMScoring = useCallback(async (state: Perception): Promise<{ scores: Scores; utterance: string }> => {
    if (!engineRef.current) return heuristicScores(state)
    const prompt = [
      'You control an NPC in a shared map game.',
      'Score each action from 0.0 to 1.0 based on the current situation.',
      'Actions: up, down, left, right, speak, rest, attack.',
      'Return JSON only with keys: scores, utterance.',
      `self=${JSON.stringify({
        name: state.self.name,
        hp: state.self.hp,
        stamina: state.self.stamina,
        lat: state.self.lat,
        lng: state.self.lng,
      })}`,
      `nearby=${JSON.stringify(state.nearby.slice(0, 6))}`,
    ].join('\n')

    const stream = await engineRef.current.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 180,
      temperature: 0.4,
    })

    let raw = ''
    for await (const chunk of stream) {
      raw += chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? ''
    }

    const parsed = parseScoringResponse(raw)
    if (parsed) return parsed
    return heuristicScores(state)
  }, [])

  const tick = useCallback(async () => {
    if (!autopilot || !perception) return
    try {
      const start = performance.now()
      const result = await runLLMScoring(perception)
      sendScores(result.scores, result.utterance)
      const ms = Math.round(performance.now() - start)
      const bestAction = Object.entries(result.scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'rest'
      setLastInference(`tick ${perception.tick}: ${bestAction} (${ms}ms)`)
    } catch {
      const fallback = heuristicScores(perception)
      sendScores(fallback.scores, fallback.utterance)
      setLastInference(`tick ${perception.tick}: fallback heuristic`)
    }
  }, [autopilot, perception, runLLMScoring, sendScores])

  useEffect(() => {
    const id = window.setInterval(() => {
      void tick()
    }, 1000)
    return () => window.clearInterval(id)
  }, [tick])

  const loadModel = useCallback(async () => {
    setModelStatus('loading')
    setLoadProgress(0)
    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
      const engine = await CreateMLCEngine('Llama-3.2-1B-Instruct-q4f16_1-MLC', {
        initProgressCallback: (p: { progress: number }) => setLoadProgress(Math.round(p.progress * 100)),
      })
      engineRef.current = engine
      setModelStatus('ready')
    } catch (err) {
      console.error(err)
      setModelStatus('error')
    }
  }, [])

  const sendManualAction = useCallback((action: keyof Scores) => {
    const scores = defaultScores()
    scores[action] = 1
    if (action !== 'rest') scores.rest = 0.1
    sendScores(scores, action === 'speak' ? 'Hello nearby NPCs.' : '')
  }, [sendScores])

  return (
    <main style={{ maxWidth: 1160, margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ marginBottom: 6 }}>NPCWorld</h1>
      <p style={{ marginTop: 0, color: '#9aa3b2' }}>
        A shared real-world map where each user pilots a browser LLM character scoring actions every second.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16 }}>
        <section style={{ background: '#101725', border: '1px solid #2a3345', borderRadius: 12, padding: 10 }}>
          <WorldMap players={players} selfId={selfId} />
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section style={{ background: '#101725', border: '1px solid #2a3345', borderRadius: 12, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Connection</h3>
            <p style={{ margin: '6px 0', color: wsConnected ? '#86efac' : '#fca5a5' }}>
              {wsConnected ? 'connected' : 'disconnected'}
            </p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="NPC name" />
            <button style={{ marginLeft: 8 }} onClick={() => wsRef.current?.send(JSON.stringify({ type: 'join', name }))}>
              Rename
            </button>
            {selfPlayer && (
              <p style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 0 }}>
                HP {selfPlayer.hp} | Stamina {selfPlayer.stamina} | Last action {selfPlayer.lastAction}
              </p>
            )}
          </section>

          <section style={{ background: '#101725', border: '1px solid #2a3345', borderRadius: 12, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Browser LLM</h3>
            {modelStatus === 'idle' && <button onClick={loadModel}>Load model</button>}
            {modelStatus === 'loading' && <p>Loading model... {loadProgress}%</p>}
            {modelStatus === 'error' && <p style={{ color: '#fca5a5' }}>Model failed. Running heuristics fallback.</p>}
            {modelStatus === 'ready' && <p style={{ color: '#86efac' }}>Model loaded (local browser inference).</p>}
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <input type="checkbox" checked={autopilot} onChange={(e) => setAutopilot(e.target.checked)} />
              autopilot (1-second scoring loop)
            </label>
            <p style={{ color: '#9aa3b2', marginBottom: 0 }}>{lastInference}</p>
          </section>

          <section style={{ background: '#101725', border: '1px solid #2a3345', borderRadius: 12, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Manual override</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <button onClick={() => sendManualAction('up')}>up</button>
              <button onClick={() => sendManualAction('down')}>down</button>
              <button onClick={() => sendManualAction('left')}>left</button>
              <button onClick={() => sendManualAction('right')}>right</button>
              <button onClick={() => sendManualAction('speak')}>speak</button>
              <button onClick={() => sendManualAction('rest')}>rest</button>
              <button onClick={() => sendManualAction('attack')}>attack</button>
            </div>
          </section>

          <section style={{ background: '#101725', border: '1px solid #2a3345', borderRadius: 12, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Nearby players</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, maxHeight: 200, overflow: 'auto' }}>
              {players.slice(0, 20).map((p) => (
                <li key={p.id} style={{ background: '#0a111d', border: '1px solid #2a3345', borderRadius: 8, padding: 8 }}>
                  <strong>{p.name}</strong> ({p.id === selfId ? 'you' : 'other'})<br />
                  <span style={{ color: '#9aa3b2', fontSize: 13 }}>
                    HP {p.hp} | ST {p.stamina} | {p.lastAction}
                    {p.speech ? ` | "${p.speech}"` : ''}
                  </span>
                </li>
              ))}
              {players.length === 0 && <li style={{ color: '#9aa3b2' }}>No active players yet.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  )
}
