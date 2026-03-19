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
    scores.speak = 0.72
    scores.attack = perception.self.stamina > 45 ? 0.5 : 0.06
    const target = nearby[0]
    if (target.lat > perception.self.lat) scores.up = 0.7
    if (target.lat < perception.self.lat) scores.down = 0.7
    if (target.lng > perception.self.lng) scores.right = 0.7
    if (target.lng < perception.self.lng) scores.left = 0.7
    return { scores, utterance: `Hey ${target.name}, what are you planning?` }
  }
  const dirs: (keyof Scores)[] = ['up', 'down', 'left', 'right']
  scores[dirs[Math.floor(Math.random() * dirs.length)]] = 0.8
  scores.rest = 0.15
  return { scores, utterance: 'Patrolling this street.' }
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
      'Style: lively and social. Prefer dynamic movement and occasional short dialogue.',
      'If speaking, write one short in-world line (5-14 words).',
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
    sendScores(scores, action === 'speak' ? 'Anyone nearby? Let us run this block.' : '')
  }, [sendScores])

  return (
    <main className="npc-page">
      <h1 className="npc-title">NPCWorld</h1>
      <p className="npc-subtitle">
        A shared real-world map where each user pilots a browser LLM character scoring actions every second.
      </p>

      <div className="npc-layout">
        <section className="npc-card npc-map-card">
          <WorldMap players={players} selfId={selfId} />
        </section>

        <aside className="npc-sidebar">
          <section className="npc-card">
            <h3 className="npc-card-title">Connection</h3>
            <p className={`npc-connection ${wsConnected ? 'ok' : 'bad'}`}>
              {wsConnected ? 'connected' : 'disconnected'}
            </p>
            <div className="npc-name-row">
              <input className="npc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="NPC name" />
              <button className="npc-button" onClick={() => wsRef.current?.send(JSON.stringify({ type: 'join', name }))}>
                Rename
              </button>
            </div>
            {selfPlayer && (
              <p className="npc-meta">
                HP {selfPlayer.hp} | Stamina {selfPlayer.stamina} | Last action {selfPlayer.actionText || selfPlayer.lastAction}
              </p>
            )}
          </section>

          <section className="npc-card">
            <h3 className="npc-card-title">Browser LLM</h3>
            {modelStatus === 'idle' && <button className="npc-button" onClick={loadModel}>Load model</button>}
            {modelStatus === 'loading' && <p className="npc-meta">Loading model... {loadProgress}%</p>}
            {modelStatus === 'error' && <p className="npc-connection bad">Model failed. Running heuristics fallback.</p>}
            {modelStatus === 'ready' && <p className="npc-connection ok">Model loaded (local browser inference).</p>}
            <label className="npc-checkbox-row">
              <input type="checkbox" checked={autopilot} onChange={(e) => setAutopilot(e.target.checked)} />
              autopilot (1-second scoring loop)
            </label>
            <p className="npc-meta">{lastInference}</p>
          </section>

          <section className="npc-card">
            <h3 className="npc-card-title">Manual override</h3>
            <div className="npc-actions-grid">
              <button className="npc-button" onClick={() => sendManualAction('up')}>up</button>
              <button className="npc-button" onClick={() => sendManualAction('down')}>down</button>
              <button className="npc-button" onClick={() => sendManualAction('left')}>left</button>
              <button className="npc-button" onClick={() => sendManualAction('right')}>right</button>
              <button className="npc-button" onClick={() => sendManualAction('speak')}>speak</button>
              <button className="npc-button" onClick={() => sendManualAction('rest')}>rest</button>
              <button className="npc-button npc-danger" onClick={() => sendManualAction('attack')}>attack</button>
            </div>
          </section>

          <section className="npc-card">
            <h3 className="npc-card-title">Nearby players</h3>
            <ul className="npc-player-list">
              {players.slice(0, 20).map((p) => (
                <li key={p.id} className="npc-player-row">
                  <strong>{p.name}</strong> ({p.id === selfId ? 'you' : 'other'})<br />
                  <span className="npc-meta">
                    HP {p.hp} | ST {p.stamina} | {p.actionText || p.lastAction}
                    {p.speech ? ` | "${p.speech}"` : ''}
                  </span>
                </li>
              ))}
              {players.length === 0 && <li className="npc-meta">No active players yet.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  )
}
