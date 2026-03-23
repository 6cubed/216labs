const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const express = require('express')
const { WebSocketServer } = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const app = next({ dev })
const handle = app.getRequestHandler()

const TICK_MS = 5000
const CENTER = { lat: 47.3769, lng: 8.5417 } // Zurich
const WORLD_BOUNDS = {
  minLat: 47.33,
  maxLat: 47.42,
  minLng: 8.46,
  maxLng: 8.62,
}
const MOVE_STEP = 0.0012
const ATTACK_RANGE = 0.001
const SPEAK_TTL_MS = 15000

/** @type {Map<string, { ws: import('ws'), player: any }>} */
const clients = new Map()
let worldTick = 0

const ACTIONS = ['up', 'down', 'left', 'right', 'speak', 'rest', 'attack']
const MOODS = ['calm', 'curious', 'playful', 'aggressive']

const AMBIENT_LINES = [
  'Anyone around this corner?',
  'Keeping watch.',
  'Street feels alive tonight.',
  'Patrolling this block.',
  'Who wants to team up?',
  'Scanning the area...',
]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomSpawn() {
  const latJitter = (Math.random() - 0.5) * 0.03
  const lngJitter = (Math.random() - 0.5) * 0.03
  return {
    lat: CENTER.lat + latJitter,
    lng: CENTER.lng + lngJitter,
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function dist(a, b) {
  const dLat = a.lat - b.lat
  const dLng = a.lng - b.lng
  return Math.sqrt((dLat * dLat) + (dLng * dLng))
}

function summarizePlayer(player) {
  const now = Date.now()
  return {
    id: player.id,
    name: player.name,
    lat: player.lat,
    lng: player.lng,
    hp: player.hp,
    stamina: player.stamina,
    lastAction: player.lastAction,
    actionText: player.actionText,
    mood: player.mood,
    emote: player.emote,
    heading: player.heading,
    speech: player.speechUntil > now ? player.speech : '',
  }
}

function toPlayerArray() {
  return Array.from(clients.values()).map((entry) => summarizePlayer(entry.player))
}

function nearby(player, radius = 0.008) {
  const all = toPlayerArray()
  return all.filter((p) => p.id !== player.id && dist(player, p) <= radius)
}

function validScores(payload) {
  if (!payload || typeof payload !== 'object') return null
  const raw = payload.scores
  if (!raw || typeof raw !== 'object') return null

  const result = {}
  for (const action of ACTIONS) {
    const n = Number(raw[action])
    result[action] = Number.isFinite(n) ? clamp(n, 0, 1) : 0
  }
  const utterance = typeof payload.utterance === 'string' ? payload.utterance.slice(0, 120).trim() : ''
  return { scores: result, utterance }
}

function autoSpeech(player, target) {
  if (target) return `Hey ${target.name}, you are in my lane.`
  if (player.hp < 40) return 'Need a breather... this is getting intense.'
  if (player.stamina < 25) return 'Catching my breath before moving.'
  return pick(AMBIENT_LINES)
}

function pickAction(player) {
  const fallback = { action: 'rest', utterance: '' }
  const latest = player.latestScoring
  if (!latest) return fallback

  const entries = ACTIONS.map((action) => [action, latest.scores[action] || 0])
    .sort((a, b) => b[1] - a[1])

  for (const [action] of entries) {
    if (action === 'attack') {
      if (player.stamina < 20) continue
      const target = findAttackTarget(player)
      if (!target) continue
      return { action, utterance: latest.utterance || '', target }
    }
    if (action === 'speak') {
      if (!latest.utterance) continue
      if (player.stamina < 5) continue
      return { action, utterance: latest.utterance }
    }
    if (['up', 'down', 'left', 'right'].includes(action) && player.stamina < 4) continue
    return { action, utterance: latest.utterance || '' }
  }
  return fallback
}

function findAttackTarget(player) {
  let closest = null
  let best = Number.POSITIVE_INFINITY
  for (const entry of clients.values()) {
    const other = entry.player
    if (other.id === player.id) continue
    const d = dist(player, other)
    if (d < ATTACK_RANGE && d < best) {
      closest = other
      best = d
    }
  }
  return closest
}

function applyAction(player, decision) {
  const now = Date.now()
  const action = decision.action
  player.lastAction = action
  player.actionText = action
  player.emote = ''

  const moodRoll = Math.random()
  if (moodRoll < 0.12) player.mood = pick(MOODS)

  if (action === 'up') {
    player.lat = clamp(player.lat + MOVE_STEP, WORLD_BOUNDS.minLat, WORLD_BOUNDS.maxLat)
    player.stamina = clamp(player.stamina - 4, 0, 100)
    player.heading = 0
    player.actionText = 'walking north'
    player.emote = '🚶'
    return
  }
  if (action === 'down') {
    player.lat = clamp(player.lat - MOVE_STEP, WORLD_BOUNDS.minLat, WORLD_BOUNDS.maxLat)
    player.stamina = clamp(player.stamina - 4, 0, 100)
    player.heading = 180
    player.actionText = 'walking south'
    player.emote = '🚶'
    return
  }
  if (action === 'left') {
    player.lng = clamp(player.lng - MOVE_STEP, WORLD_BOUNDS.minLng, WORLD_BOUNDS.maxLng)
    player.stamina = clamp(player.stamina - 4, 0, 100)
    player.heading = 270
    player.actionText = 'walking west'
    player.emote = '🚶'
    return
  }
  if (action === 'right') {
    player.lng = clamp(player.lng + MOVE_STEP, WORLD_BOUNDS.minLng, WORLD_BOUNDS.maxLng)
    player.stamina = clamp(player.stamina - 4, 0, 100)
    player.heading = 90
    player.actionText = 'walking east'
    player.emote = '🚶'
    return
  }
  if (action === 'speak') {
    player.stamina = clamp(player.stamina - 5, 0, 100)
    const target = findAttackTarget(player)
    player.speech = decision.utterance || autoSpeech(player, target)
    player.speechUntil = now + SPEAK_TTL_MS
    player.actionText = 'chatting'
    player.emote = '💬'
    return
  }
  if (action === 'attack') {
    const target = decision.target || findAttackTarget(player)
    if (!target || player.stamina < 20) {
      player.lastAction = 'rest'
      player.stamina = clamp(player.stamina + 8, 0, 100)
      player.actionText = 'regrouping'
      player.emote = '😮‍💨'
      return
    }
    player.stamina = clamp(player.stamina - 20, 0, 100)
    target.hp = clamp(target.hp - 20, 0, 100)
    player.actionText = `attacking ${target.name}`
    player.emote = '⚔️'
    target.speech = `${target.name} takes a hit!`
    target.speechUntil = now + 2000
    if (target.hp <= 0) {
      const spawn = randomSpawn()
      target.hp = 100
      target.stamina = 100
      target.lat = clamp(spawn.lat, WORLD_BOUNDS.minLat, WORLD_BOUNDS.maxLat)
      target.lng = clamp(spawn.lng, WORLD_BOUNDS.minLng, WORLD_BOUNDS.maxLng)
      target.speech = 'Respawned and back in the streets.'
      target.speechUntil = now + 2500
      target.actionText = 'respawned'
      target.emote = '✨'
    }
    return
  }

  player.stamina = clamp(player.stamina + 10, 0, 100)
  player.actionText = 'resting'
  player.emote = '🧘'
  if (player.stamina > 80 && Math.random() < 0.2) {
    player.speech = pick(['Ready to move again.', 'Energy restored.', 'Back on patrol.'])
    player.speechUntil = now + 2500
  }
}

function runTick() {
  worldTick += 1
  for (const entry of clients.values()) {
    const p = entry.player
    const decision = pickAction(p)
    applyAction(p, decision)
  }

  const players = toPlayerArray()
  for (const entry of clients.values()) {
    if (entry.ws.readyState !== 1) continue
    const p = entry.player
    const perception = {
      type: 'perception',
      tick: worldTick,
      self: summarizePlayer(p),
      nearby: nearby(p),
    }
    entry.ws.send(JSON.stringify(perception))
    entry.ws.send(JSON.stringify({ type: 'snapshot', tick: worldTick, players }))
  }
}

app.prepare().then(() => {
  const expressApp = express()

  expressApp.get('/health', (_req, res) => res.json({ ok: true, clients: clients.size, tick: worldTick }))
  expressApp.get('*', (req, res) => handle(req, res, parse(req.url, true)))

  const server = createServer(expressApp)
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws) => {
    const id = Math.random().toString(36).slice(2, 10)
    const spawn = randomSpawn()
    const player = {
      id,
      name: `NPC-${id.slice(0, 4)}`,
      lat: clamp(spawn.lat, WORLD_BOUNDS.minLat, WORLD_BOUNDS.maxLat),
      lng: clamp(spawn.lng, WORLD_BOUNDS.minLng, WORLD_BOUNDS.maxLng),
      hp: 100,
      stamina: 100,
      lastAction: 'rest',
      actionText: 'spawning in',
      mood: pick(MOODS),
      emote: '👀',
      heading: Math.floor(Math.random() * 360),
      speech: '',
      speechUntil: 0,
      latestScoring: null,
    }

    clients.set(id, { ws, player })
    ws.send(JSON.stringify({
      type: 'init',
      selfId: id,
      tickMs: TICK_MS,
      worldBounds: WORLD_BOUNDS,
      players: toPlayerArray(),
    }))

    ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      const current = clients.get(id)
      if (!current) return

      if (msg.type === 'join' && typeof msg.name === 'string') {
        current.player.name = msg.name.trim().slice(0, 24) || current.player.name
        return
      }

      if (msg.type === 'action_scores') {
        const parsed = validScores(msg)
        if (!parsed) {
          ws.send(JSON.stringify({ type: 'reject_scores', reason: 'invalid_format' }))
          return
        }
        current.player.latestScoring = parsed
      }
    })

    ws.on('close', () => clients.delete(id))
    ws.on('error', () => clients.delete(id))
  })

  setInterval(runTick, TICK_MS)

  server.listen(port, () => {
    console.log(`> NPCWorld ready on http://localhost:${port}`)
  })
})
