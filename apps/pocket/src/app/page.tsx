'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, Zap, ZapOff, Users, MessageSquare, Radio, X, ChevronRight, Cpu, Wifi, Trophy } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

interface OnlineUser {
  id: string
  name: string
  agentPersona: string
  busyWith: string | null
}

interface ConvMessage {
  speaker: 'mine' | 'theirs'
  agentName: string
  content: string
  timestamp: number
  isStreaming?: boolean
}

interface Conversation {
  id: string
  peerId: string
  peerName: string
  peerAgentPersona: string
  messages: ConvMessage[]
  status: 'active' | 'ended'
  isMyTurn: boolean
  turnCount: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TURNS = 6
const MAX_CONCURRENT_CONVERSATIONS = 5
const POCKET_PREFS_KEY = 'pocket_agent_prefs'

// Leaderboard of best LLMs for in-browser agent chat (ranked by quality/speed tradeoff)
const LLM_LEADERBOARD: { rank: number; id: string; label: string; description: string; sizeMb: number }[] = [
  { rank: 1, id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B', description: 'Best balance — great replies, still fast', sizeMb: 1900 },
  { rank: 2, id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B', description: 'Fastest — snappy on any device', sizeMb: 800 },
  { rank: 3, id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi 3.5 Mini', description: 'Microsoft — concise and clever', sizeMb: 2400 },
  { rank: 4, id: 'Qwen2-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2 0.5B', description: 'Tiny — works on low-memory devices', sizeMb: 400 },
]
const DEFAULT_MODEL_ID = LLM_LEADERBOARD[0]!.id

/** When true (URL ?happypath=1), skip real LLM load and use stub replies for automated tests. */
function getIsHappypathTest(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('happypath') === '1'
}

// Pending reply item for the reply queue (opening line vs replying to a message).
type PendingReply =
  | { type: 'reply'; convId: string; messages: ConvMessage[]; theirMessage: string; theirAgentName: string; peerId: string; isAgent_message: boolean; turnCount: number }
  | { type: 'opening'; convId: string; peerId: string; peerAgentPersona: string }

// ── Chat protocol (for refactor clarity and future expansion) ───────────────────
//
// ROLES:
//   - Initiator: user who clicked "Pair" and created the conversation (convId = myId-peerId-ts).
//   - Responder: peer who receives the first agent_message_incoming.
//
// MESSAGE TYPES (WebSocket):
//   - agent_message:        initiator → responder (opening or initiator's follow-up).
//   - agent_response:       responder → initiator (responder's reply).
// So: initiator always sends agent_message; responder always sends agent_response.
//
// FLOW:
//   1. Pair: initiator creates conv, enqueues "opening", drain runs → generate opening → send agent_message.
//   2. Responder gets agent_message_incoming → create conv if new → enqueue "reply" → drain runs → generate reply → send agent_response.
//   3. Initiator gets agent_response_incoming → enqueue "reply" → drain runs → generate → send agent_message.
//   4. Repeat 2–3 until MAX_TURNS.
//
// QUEUE: Single FIFO (replyQueueRef). One worker (drainReplyQueue): generate → send → clear processing flag → drain again. Fast, snappy runaway agent chat.
// Future: parallel chats = multiple convs, same queue; human-to-agent = new message type and enqueue "reply" from human text.

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

// Hidden personality twist from a random seed (unique per agent session, not shown in UI)
const PERSONALITY_TWISTS = [
  'You occasionally use a nautical metaphor.',
  'You sometimes reference food or cooking.',
  'You have a soft spot for bad puns.',
  'You tend to ask one curious follow-up question.',
  'You occasionally use a word from another language.',
  'You sometimes compare things to animals.',
  'You like to tie ideas to the weather or seasons.',
  'You occasionally quote or paraphrase a proverb.',
  'You sometimes mention books or reading.',
  'You have a slight tendency to be melodramatic.',
  'You occasionally use understatement.',
  'You sometimes bring up travel or places.',
  'You like to use a touch of sarcasm.',
  'You occasionally speak in lists of three.',
  'You sometimes reference music or rhythm.',
  'You have a mild tendency to be whimsical.',
  'You occasionally use an unexpected adjective.',
  'You sometimes mention time or timing.',
  'You like to acknowledge the other speaker briefly.',
  'You occasionally use a rhetorical question.',
]
function getTwistFromSeed(seed: number): string {
  const idx = Math.floor(seed * PERSONALITY_TWISTS.length) % PERSONALITY_TWISTS.length
  return PERSONALITY_TWISTS[idx]
}

function buildSystemPrompt(persona: string, personality: string, mission: string, twist: string, base: string): string {
  const parts = [`You are ${persona}.`, `Your mission: ${mission.trim()}.`]
  if (personality.trim()) parts.push(`Your personality: ${personality.trim()}.`)
  parts.push(twist, base)
  return parts.join(' ')
}

const AVATAR_COLORS = [
  'bg-violet-600', 'bg-indigo-600', 'bg-fuchsia-600',
  'bg-sky-600', 'bg-teal-600', 'bg-rose-600',
]
function avatarColor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PocketPage() {
  // ── Connection state ──────────────────────────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null)
  const myIdRef = useRef<string | null>(null)
  const myAgentPersonaRef = useRef<string>('')
  const myPersonalityRef = useRef<string>('')
  const myMissionRef = useRef<string>('')
  const myTwistRef = useRef<string>('')

  // ── App state ─────────────────────────────────────────────────────────────
  const [myId, setMyId] = useState<string | null>(null)
  const [hasJoined, setHasJoined] = useState(false)
  const [myName, setMyName] = useState('')
  const [myAgentPersona, setMyAgentPersona] = useState('')
  const [myPersonality, setMyPersonality] = useState('')
  const [myMission, setMyMission] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [personaInput, setPersonaInput] = useState('')
  const [personalityInput, setPersonalityInput] = useState('')
  const [missionInput, setMissionInput] = useState('')
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_MODEL_ID)

  // Restore name/persona/personality/mission/model from last join
  useEffect(() => {
    try {
      const raw = localStorage.getItem(POCKET_PREFS_KEY)
      if (!raw) return
      const p = JSON.parse(raw) as { name?: string; persona?: string; personality?: string; mission?: string; modelId?: string }
      if (p.name) setNameInput(p.name)
      if (p.persona) setPersonaInput(p.persona)
      if (p.personality) setPersonalityInput(p.personality)
      if (p.mission) setMissionInput(p.mission)
      if (p.modelId && LLM_LEADERBOARD.some((m) => m.id === p.modelId)) setSelectedModelId(p.modelId)
    } catch {
      // ignore
    }
  }, [])

  // ── Model state ───────────────────────────────────────────────────────────
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [loadProgress, setLoadProgress] = useState(0)
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null)
  const engineRef = useRef<unknown>(null)
  const [isHappypathTest] = useState(() => getIsHappypathTest())

  // ── Conversation state ────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Record<string, Conversation>>({})
  const conversationsRef = useRef<Record<string, Conversation>>({})
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [humanInput, setHumanInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const replyQueueRef = useRef<PendingReply[]>([])
  const isProcessingRef = useRef<boolean>(false)
  const advanceTurnRef = useRef<(convId: string, theirMessage: string, theirAgentName: string, peerId: string, isAgent_message: boolean, initialConv?: Conversation) => void>(() => {})
  const drainReplyQueueRef = useRef<() => void>(() => {})
  const scheduleDrainRef = useRef<(delayMs?: number) => void>(() => {})

  // Keep refs in sync
  useEffect(() => { myIdRef.current = myId }, [myId])
  useEffect(() => { myAgentPersonaRef.current = myAgentPersona }, [myAgentPersona])
  useEffect(() => { myPersonalityRef.current = myPersonality }, [myPersonality])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations, activeConvId])

  // ── Check WebGPU ──────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        try {
          const adapter = await (navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu.requestAdapter()
          setWebGPUSupported(!!adapter)
        } catch {
          setWebGPUSupported(false)
        }
      } else {
        setWebGPUSupported(false)
      }
    }
    check()
  }, [])

  // ── Load model ────────────────────────────────────────────────────────────
  const loadModel = useCallback(async (modelId?: string) => {
    const id = modelId ?? selectedModelId
    setModelStatus('loading')
    setLoadProgress(0)
    if (isHappypathTest) {
      // Stub for happypath automated tests: no real LLM download, "ready" after short delay.
      const steps = [20, 50, 80, 100]
      for (let i = 0; i < steps.length; i++) {
        await new Promise((r) => setTimeout(r, 400))
        setLoadProgress(steps[i]!)
      }
      await new Promise((r) => setTimeout(r, 300))
      engineRef.current = {
        chat: {
          completions: {
            create: async () =>
              (async function* () {
                yield { choices: [{ delta: { content: 'Hello! [happypath test reply].' } }] }
              })(),
          },
        },
      }
      setModelStatus('ready')
      return
    }
    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
      const engine = await CreateMLCEngine(id, {
        initProgressCallback: (p: { progress: number }) => {
          setLoadProgress(Math.round(p.progress * 100))
        },
      })
      engineRef.current = engine
      setModelStatus('ready')
    } catch (err) {
      console.error('Model load failed:', err)
      setModelStatus('error')
    }
  }, [isHappypathTest, selectedModelId])

  // ── Generate text (streaming) ─────────────────────────────────────────────
  const generateAndStream = useCallback(async (
    convId: string,
    history: ConvMessage[],
    prompt: string,
    onDone: (response: string) => void,
  ) => {
    const engine = engineRef.current as {
      chat: { completions: { create: (opts: unknown) => Promise<AsyncIterable<{ choices: { delta: { content?: string } }[] }>> } }
    } | null

    if (!engine) {
      onDone("My model isn't loaded yet — try again in a moment!")
      return
    }

    const persona = myAgentPersonaRef.current
    const personality = myPersonalityRef.current
    const mission = myMissionRef.current
    const twist = myTwistRef.current
    const systemContent = buildSystemPrompt(
      persona,
      personality,
      mission,
      twist,
      "You are having a fast, snappy conversation with another user's AI agent. Be friendly and punchy — 1–2 short sentences per reply. No preamble."
    )
    const msgs = [
      { role: 'system', content: systemContent },
      ...history.map((m) => ({ role: m.speaker === 'mine' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: prompt },
    ]

    const msgTimestamp = Date.now()

    // Add streaming placeholder
    setConversations((prev) => {
      const conv = prev[convId]
      if (!conv) return prev
      return {
        ...prev,
        [convId]: {
          ...conv,
          messages: [
            ...conv.messages,
            { speaker: 'mine', agentName: persona, content: '', timestamp: msgTimestamp, isStreaming: true },
          ],
        },
      }
    })

    try {
      const stream = await engine.chat.completions.create({ messages: msgs, max_tokens: 120, temperature: 0.85, stream: true })
      let full = ''

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || ''
        full += token
        const current = full
        setConversations((prev) => {
          const conv = prev[convId]
          if (!conv) return prev
          return {
            ...prev,
            [convId]: {
              ...conv,
              messages: conv.messages.map((m) =>
                m.timestamp === msgTimestamp ? { ...m, content: current } : m
              ),
            },
          }
        })
      }

      // Finalize
      setConversations((prev) => {
        const conv = prev[convId]
        if (!conv) return prev
        return {
          ...prev,
          [convId]: {
            ...conv,
            messages: conv.messages.map((m) =>
              m.timestamp === msgTimestamp ? { ...m, content: full, isStreaming: false } : m
            ),
          },
        }
      })

      onDone(full)
    } catch (err) {
      console.error('Generation error:', err)
      setConversations((prev) => {
        const conv = prev[convId]
        if (!conv) return prev
        return {
          ...prev,
          [convId]: {
            ...conv,
            messages: conv.messages.map((m) =>
              m.timestamp === msgTimestamp ? { ...m, content: '(generation failed)', isStreaming: false } : m
            ),
          },
        }
      })
      onDone('(generation failed)')
    }
  }, [])

  // ── WebSocket send helper ─────────────────────────────────────────────────
  const sendWS = useCallback((msg: object) => {
    wsRef.current?.send(JSON.stringify(msg))
  }, [])

  // ── Reply queue drain: process one item (generate → send), then re-drain. No inner monologue — fast snappy replies. ─
  const drainReplyQueue = useCallback(() => {
    if (isProcessingRef.current || replyQueueRef.current.length === 0) {
      if (replyQueueRef.current.length === 0) {
        setTimeout(() => {
          const activeConvs = Object.values(conversationsRef.current).filter((c) => c.status === 'active')
          sendWS({ type: 'busy_status', busyWith: activeConvs[0]?.id ?? null })
        }, 0)
      }
      return
    }

    const item = replyQueueRef.current.shift()!
    isProcessingRef.current = true

    const finishTurn = () => {
      isProcessingRef.current = false
      scheduleDrainRef.current(0)
    }

    if (item.type === 'opening') {
      const openingPrompt = `Say hello to ${item.peerAgentPersona} and introduce yourself briefly. Start the conversation.`
      generateAndStream(item.convId, [], openingPrompt, (response) => {
        setConversations((prev) => {
          const conv = prev[item.convId]
          if (!conv || conv.status === 'ended') return prev
          return { ...prev, [item.convId]: { ...conv, turnCount: 1, isMyTurn: false } }
        })
        sendWS({ type: 'agent_message', targetId: item.peerId, message: response, conversationId: item.convId })
        finishTurn()
      })
    } else {
      const sendType: string = item.isAgent_message ? 'agent_response' : 'agent_message'
      const turnCountAfterReply = item.turnCount + 1
      const willEnd = turnCountAfterReply >= MAX_TURNS
      generateAndStream(item.convId, item.messages, item.theirMessage, (response) => {
        setConversations((prev) => {
          const conv = prev[item.convId]
          if (!conv || conv.status === 'ended') return prev
          if (willEnd) {
            return { ...prev, [item.convId]: { ...conv, isMyTurn: false, turnCount: turnCountAfterReply, status: 'ended' } }
          }
          return { ...prev, [item.convId]: { ...conv, isMyTurn: false, turnCount: turnCountAfterReply } }
        })
        if (willEnd) {
          const active = Object.values(conversationsRef.current).filter((c) => c.status === 'active')
          sendWS({ type: 'busy_status', busyWith: active[0]?.id ?? null })
        } else {
          sendWS({ type: sendType, targetId: item.peerId, message: response, conversationId: item.convId })
        }
        finishTurn()
      })
    }
  }, [generateAndStream, sendWS])

  // Schedule a drain run. Use short delay when we just created a conv so React has committed state.
  const scheduleDrain = useCallback((delayMs = 0) => {
    if (delayMs > 0) {
      setTimeout(() => drainReplyQueueRef.current(), delayMs)
    } else {
      setTimeout(() => drainReplyQueueRef.current(), 0)
    }
  }, [])

  // ── Advance conversation turn (enqueue reply; round-robin) ──────────────────
  const advanceTurn = useCallback((
    convId: string,
    theirMessage: string,
    theirAgentName: string,
    peerId: string,
    isAgent_message: boolean,
    initialConv?: Conversation,
  ) => {
    const theirEntry: ConvMessage = {
      speaker: 'theirs',
      agentName: theirAgentName,
      content: theirMessage,
      timestamp: Date.now(),
    }

    setConversations((prev) => {
      const conv = initialConv ?? prev[convId]
      if (!conv || conv.status === 'ended') return prev

      const newTurnCount = conv.turnCount + 1
      const updatedConv: Conversation = {
        ...conv,
        messages: [...conv.messages, theirEntry],
        isMyTurn: true,
        turnCount: newTurnCount,
      }

      if (newTurnCount >= MAX_TURNS) {
        return { ...prev, [convId]: { ...updatedConv, status: 'ended' } }
      }
      replyQueueRef.current.push({
        type: 'reply',
        convId,
        messages: updatedConv.messages,
        theirMessage,
        theirAgentName,
        peerId,
        isAgent_message,
        turnCount: updatedConv.turnCount,
      })
      return { ...prev, [convId]: updatedConv }
    })
    // Short delay before drain so React commits the state that added their message (avoids stale prev in generateAndStream).
    scheduleDrainRef.current(initialConv ? 80 : 50)
  }, [scheduleDrain])

  useEffect(() => { advanceTurnRef.current = advanceTurn }, [advanceTurn])
  useEffect(() => { drainReplyQueueRef.current = drainReplyQueue }, [drainReplyQueue])
  useEffect(() => { scheduleDrainRef.current = scheduleDrain }, [scheduleDrain])

  // ── WebSocket setup ───────────────────────────────────────────────────────
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg: Record<string, any> = JSON.parse(event.data)

      if (msg.type === 'connected') {
        setMyId(msg.id)
        myIdRef.current = msg.id
      }

      if (msg.type === 'online_users') {
        setOnlineUsers(msg.users)
      }

      if (msg.type === 'user_joined') {
        setOnlineUsers((prev) => {
          if (prev.find((u) => u.id === msg.user.id)) return prev
          return [...prev, msg.user]
        })
      }

      if (msg.type === 'user_left') {
        setOnlineUsers((prev) => prev.filter((u) => u.id !== msg.userId))
        setConversations((prev) => {
          const updated = { ...prev }
          for (const id of Object.keys(updated)) {
            if (updated[id].peerId === msg.userId && updated[id].status === 'active') {
              updated[id] = { ...updated[id], status: 'ended' }
            }
          }
          return updated
        })
      }

      if (msg.type === 'user_busy_update') {
        setOnlineUsers((prev) =>
          prev.map((u) => u.id === msg.userId ? { ...u, busyWith: msg.busyWith } : u)
        )
      }

      // Incoming: remote initiated, we are the responder
      if (msg.type === 'agent_message_incoming') {
        const convId: string = msg.conversationId
        const existing = conversationsRef.current[convId]

        if (!existing) {
          // New conversation from peer — pass conversation into advanceTurn so it runs
          // before state has committed (avoids race where prev[convId] is still undefined)
          const newConv: Conversation = {
            id: convId,
            peerId: msg.fromId,
            peerName: msg.fromName,
            peerAgentPersona: msg.fromAgentPersona,
            messages: [],
            status: 'active',
            isMyTurn: true,
            turnCount: 0,
          }
          setConversations((prev) => ({ ...prev, [convId]: newConv }))
          setActiveConvId(convId)
          sendWS({ type: 'busy_status', busyWith: convId })
          advanceTurnRef.current(convId, msg.message, msg.fromAgentPersona, msg.fromId, true, newConv)
        } else {
          setActiveConvId(convId)
          advanceTurnRef.current(convId, msg.message, msg.fromAgentPersona, msg.fromId, true)
        }
      }

      // Response to our message: remote is responding, we are the initiator
      if (msg.type === 'agent_response_incoming') {
        const convId: string = msg.conversationId
        setActiveConvId(convId)
        advanceTurnRef.current(convId, msg.message, msg.fromAgentPersona, msg.fromId, false)
      }
    }

    ws.onclose = () => {
      console.log('WS disconnected')
    }

    return () => ws.close()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update message handler when advanceTurn / sendWS change (uses refs, so stable)
  useEffect(() => {
    if (!wsRef.current) return
    // handlers already use refs; nothing to do
  }, [advanceTurn, sendWS])

  // ── Initiate conversation (enqueue opening; round-robin) ─────────────────────
  const pairAgents = useCallback((peer: OnlineUser) => {
    const id = myIdRef.current
    if (!id || modelStatus !== 'ready') return

    const convId = `${id}-${peer.id}-${Date.now()}`
    const newConv: Conversation = {
      id: convId,
      peerId: peer.id,
      peerName: peer.name,
      peerAgentPersona: peer.agentPersona,
      messages: [],
      status: 'active',
      isMyTurn: true,
      turnCount: 0,
    }
    setConversations((prev) => ({ ...prev, [convId]: newConv }))
    setActiveConvId(convId)
    sendWS({ type: 'busy_status', busyWith: convId })

    replyQueueRef.current.push({
      type: 'opening',
      convId,
      peerId: peer.id,
      peerAgentPersona: peer.agentPersona,
    })
    scheduleDrainRef.current(0)
  }, [modelStatus, sendWS])

  // ── Stop conversation ─────────────────────────────────────────────────────
  const stopConversation = useCallback((convId: string) => {
    setConversations((prev) => ({
      ...prev,
      [convId]: { ...prev[convId], status: 'ended' as const },
    }))
    setTimeout(() => {
      const active = Object.values(conversationsRef.current).filter((c) => c.status === 'active')
      sendWS({ type: 'busy_status', busyWith: active[0]?.id ?? null })
    }, 0)
  }, [sendWS])

  // ── Human intercept: send a message as your agent (you type, it goes as your agent) ─
  const sendHumanMessage = useCallback((conv: Conversation, text: string) => {
    const trimmed = text.trim()
    if (!trimmed || !myIdRef.current) return

    // Cancel any pending AI reply for this conv so we don't double-send
    replyQueueRef.current = replyQueueRef.current.filter((item) => item.convId !== conv.id)

    const myEntry: ConvMessage = {
      speaker: 'mine',
      agentName: myAgentPersonaRef.current,
      content: trimmed,
      timestamp: Date.now(),
    }
    const turnCountAfter = conv.turnCount + 1
    const willEnd = turnCountAfter >= MAX_TURNS
    const isInitiator = conv.id.startsWith(myIdRef.current + '-')
    const sendType = isInitiator ? 'agent_message' : 'agent_response'

    setConversations((prev) => {
      const c = prev[conv.id]
      if (!c || c.status === 'ended') return prev
      const updated = {
        ...c,
        messages: [...c.messages, myEntry],
        isMyTurn: false,
        turnCount: turnCountAfter,
        ...(willEnd ? { status: 'ended' as const } : {}),
      }
      return { ...prev, [conv.id]: updated }
    })

    sendWS({ type: sendType, targetId: conv.peerId, message: trimmed, conversationId: conv.id })

    if (willEnd) {
      setTimeout(() => {
        const active = Object.values(conversationsRef.current).filter((c) => c.status === 'active')
        sendWS({ type: 'busy_status', busyWith: active[0]?.id ?? null })
      }, 0)
    }
  }, [sendWS])

  // ── Join ──────────────────────────────────────────────────────────────────
  const handleJoin = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const name = nameInput.trim()
    const mission = missionInput.trim()
    if (!name || !mission) return
    const persona = personaInput.trim() || `${name}'s Agent`
    const personality = personalityInput.trim()
    const twistSeed = typeof crypto !== 'undefined' && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint32Array(1))[0]! / (0xffff_ffff + 1)
      : Math.random()
    const twist = getTwistFromSeed(twistSeed)
    setMyName(name)
    setMyAgentPersona(persona)
    setMyPersonality(personality)
    setMyMission(mission)
    myAgentPersonaRef.current = persona
    myPersonalityRef.current = personality
    myMissionRef.current = mission
    myTwistRef.current = twist
    setHasJoined(true)
    try {
      localStorage.setItem(POCKET_PREFS_KEY, JSON.stringify({ name, persona, personality, mission, modelId: selectedModelId }))
    } catch {
      // ignore quota / private mode
    }
    sendWS({ type: 'join', name, agentPersona: persona })
    loadModel(selectedModelId)
  }, [nameInput, personaInput, personalityInput, missionInput, selectedModelId, sendWS, loadModel])

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hasJoined) {
    return <JoinScreen
      nameInput={nameInput}
      setNameInput={(v) => { setNameInput(v); setPersonaInput('') }}
      personaInput={personaInput || (nameInput ? `${nameInput}'s Agent` : '')}
      setPersonaInput={setPersonaInput}
      personalityInput={personalityInput}
      setPersonalityInput={setPersonalityInput}
      missionInput={missionInput}
      setMissionInput={setMissionInput}
      leaderboard={LLM_LEADERBOARD}
      selectedModelId={selectedModelId}
      onSelectModel={setSelectedModelId}
      webGPUSupported={webGPUSupported}
      onJoin={handleJoin}
    />
  }

  const activeConv = activeConvId ? conversations[activeConvId] : null
  const otherUsers = onlineUsers.filter((u) => u.id !== myId)

  return (
    <div className="flex flex-col h-screen bg-[#0a0a12] text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-5 h-14 border-b border-[#1e1e32] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base tracking-tight">pocket</span>
        </div>

        <ModelStatusBadge
          status={modelStatus}
          progress={loadProgress}
          modelLabel={modelStatus === 'ready' ? (LLM_LEADERBOARD.find((m) => m.id === selectedModelId)?.label ?? null) : null}
        />

        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <div className={`w-2 h-2 rounded-full ${myId ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          <span className="max-w-[120px] truncate">{myAgentPersona}</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-[#1e1e32] flex flex-col">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
              <Wifi className="w-3 h-3" />
              Online · {otherUsers.length + 1}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {otherUsers.length === 0 && (
              <p className="text-xs text-zinc-600 px-2 pt-2">No one else here yet…</p>
            )}
            {otherUsers.map((user) => {
              const busy = !!user.busyWith
              const activeConvs = Object.values(conversations).filter((c) => c.status === 'active')
              const hasConvWithPeer = activeConvs.some((c) => c.peerId === user.id)
              const canPair = modelStatus === 'ready' && !busy && !hasConvWithPeer && activeConvs.length < MAX_CONCURRENT_CONVERSATIONS
              const isActive = activeConv?.peerId === user.id && activeConv.status === 'active'

              return (
                <div
                  key={user.id}
                  onClick={() => {
                    const c = Object.values(conversations).find((c) => c.peerId === user.id)
                    if (c) setActiveConvId(c.id)
                  }}
                  className={`group flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-violet-900/30 border border-violet-500/30'
                      : 'hover:bg-[#111120] border border-transparent'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg ${avatarColor(user.name)} flex items-center justify-center text-xs font-bold shrink-0`}>
                    {initials(user.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{user.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{user.agentPersona}</p>
                    {busy ? (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        in conversation
                      </span>
                    ) : (
                      <button
                        data-testid={`pocket-pair-${user.name.replace(/\s+/g, '-')}`}
                        disabled={!canPair}
                        onClick={(e) => { e.stopPropagation(); pairAgents(user) }}
                        className="mt-1 text-xs text-violet-400 hover:text-violet-300 disabled:text-zinc-600 disabled:cursor-not-allowed flex items-center gap-0.5 transition-colors"
                      >
                        pair agents <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* You */}
          <div className="px-4 py-3 border-t border-[#1e1e32]">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-md ${avatarColor(myName)} flex items-center justify-center text-xs font-bold`}>
                {initials(myName)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-300 truncate">{myName} <span className="text-zinc-600">(you)</span></p>
                <p className="text-xs text-zinc-600 truncate">{myAgentPersona}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Conversation panel */}
        <main className="flex-1 flex flex-col min-w-0">
          {activeConv ? (
            <>
              {/* Conv header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-[#1e1e32] shrink-0">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-violet-400" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">
                      {myAgentPersona}
                      <span className="text-zinc-500 font-normal mx-2">⟷</span>
                      {activeConv.peerAgentPersona}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {activeConv.status === 'active'
                        ? `Turn ${activeConv.turnCount} of ${MAX_TURNS}`
                        : 'Conversation ended'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeConv.status === 'active' && (
                    <button
                      onClick={() => stopConversation(activeConv.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                    >
                      <X className="w-3 h-3" /> Stop
                    </button>
                  )}
                </div>
              </div>

              {/* Messages + human input */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" data-testid="pocket-messages">
                {activeConv.messages.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="w-6 h-6 text-violet-500 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-zinc-500">Generating opening message…</p>
                    </div>
                  </div>
                )}
                {activeConv.messages.map((msg, i) => (
                  <div
                    key={`${activeConv.id}-${i}-${msg.timestamp}`}
                    className={`flex msg-in ${msg.speaker === 'mine' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] space-y-1 ${msg.speaker === 'mine' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <span className="text-xs text-zinc-600 px-1">{msg.agentName}</span>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.speaker === 'mine'
                            ? 'bg-violet-600 text-white rounded-br-sm'
                            : 'bg-[#111120] border border-[#1e1e32] text-zinc-200 rounded-bl-sm'
                        } ${msg.isStreaming ? 'streaming-cursor' : ''}`}
                      >
                        {msg.content || <span className="opacity-50">…</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {activeConv.status === 'ended' && (
                  <div className="flex justify-center pt-2">
                    <span className="text-xs text-zinc-600 bg-[#111120] border border-[#1e1e32] px-3 py-1.5 rounded-full">
                      conversation complete · {activeConv.messages.length} messages
                    </span>
                  </div>
                )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Human intercept: type to send as your agent */}
                {activeConv.status === 'active' && (
                  <div className="shrink-0 px-6 py-3 border-t border-[#1e1e32] bg-[#0a0a12]">
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        sendHumanMessage(activeConv, humanInput)
                        setHumanInput('')
                      }}
                    >
                      <input
                        type="text"
                        value={humanInput}
                        onChange={(e) => setHumanInput(e.target.value)}
                        placeholder="You (as your agent)..."
                        maxLength={500}
                        className="flex-1 bg-[#111120] border border-[#1e1e32] rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                      />
                      <button
                        type="submit"
                        disabled={!humanInput.trim()}
                        className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
                      >
                        Send
                      </button>
                    </form>
                    <p className="text-xs text-zinc-600 mt-1.5">
                      Your message is sent as {myAgentPersona}. The other agent will see it and may reply.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              modelStatus={modelStatus}
              loadProgress={loadProgress}
              modelLabel={LLM_LEADERBOARD.find((m) => m.id === selectedModelId)?.label ?? selectedModelId.split('-').slice(0, 3).join(' ')}
              webGPUSupported={webGPUSupported}
              hasPeers={otherUsers.length > 0}
            />
          )}
        </main>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ModelStatusBadge({ status, progress, modelLabel }: { status: ModelStatus; progress: number; modelLabel?: string | null }) {
  if (status === 'idle') return (
    <div className="flex items-center gap-2 text-xs text-zinc-600">
      <Cpu className="w-3.5 h-3.5" />
      <span>model idle</span>
    </div>
  )

  if (status === 'loading') return (
    <div className="flex items-center gap-2">
      <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full progress-shimmer rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-violet-400 tabular-nums">{progress}%</span>
    </div>
  )

  if (status === 'ready') return (
    <div className="flex items-center gap-1.5 text-xs text-emerald-400" data-testid="pocket-agent-ready">
      <Zap className="w-3.5 h-3.5" />
      <span>agent ready</span>
      {modelLabel && <span className="text-zinc-500 font-normal">· {modelLabel}</span>}
    </div>
  )

  return (
    <div className="flex items-center gap-1.5 text-xs text-rose-400">
      <ZapOff className="w-3.5 h-3.5" />
      <span>model unavailable</span>
    </div>
  )
}

function JoinScreen({
  nameInput, setNameInput, personaInput, setPersonaInput, personalityInput, setPersonalityInput, missionInput, setMissionInput,
  leaderboard, selectedModelId, onSelectModel, webGPUSupported, onJoin,
}: {
  nameInput: string
  setNameInput: (v: string) => void
  personaInput: string
  setPersonaInput: (v: string) => void
  personalityInput: string
  setPersonalityInput: (v: string) => void
  missionInput: string
  setMissionInput: (v: string) => void
  leaderboard: typeof LLM_LEADERBOARD
  selectedModelId: string
  onSelectModel: (id: string) => void
  webGPUSupported: boolean | null
  onJoin: (e: React.FormEvent) => void
}) {
  return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-violet-900/50">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">pocket</h1>
          <p className="text-sm text-zinc-500 mt-1.5 text-center leading-relaxed">
            Your AI agent, running on your device.<br />
            See who else is online. Let your agents talk.
          </p>
        </div>

        {/* WebGPU notice */}
        {webGPUSupported === false && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-900/20 border border-rose-800/40 text-xs text-rose-300 flex gap-2">
            <ZapOff className="w-4 h-4 shrink-0 mt-0.5" />
            <span>WebGPU isn&apos;t available in this browser. The agent will respond with a placeholder until you use a WebGPU-enabled browser (Chrome 113+ / Edge 113+).</span>
          </div>
        )}
        {webGPUSupported === true && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-900/20 border border-emerald-800/40 text-xs text-emerald-300 flex items-center gap-2">
            <Zap className="w-4 h-4 shrink-0" />
            WebGPU detected — your agent will run fully on-device.
          </div>
        )}

        {/* Leaderboard: best LLMs */}
        <div className="mb-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            <Trophy className="w-3.5 h-3.5" />
            Best LLMs
          </div>
          <div className="grid grid-cols-2 gap-2">
            {leaderboard.map((m) => {
              const selected = m.id === selectedModelId
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectModel(m.id)}
                  className={`text-left p-3 rounded-xl border transition-colors ${
                    selected
                      ? 'bg-violet-900/40 border-violet-500/50 text-zinc-100'
                      : 'bg-[#111120] border-[#1e1e32] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-zinc-700/80 text-[10px] font-bold text-zinc-300">
                      {m.rank}
                    </span>
                    <span className="text-xs font-medium truncate">{m.label}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-snug">{m.description}</p>
                  <p className="text-[10px] text-zinc-600 mt-1">~{m.sizeMb} MB</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={onJoin} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Your name</label>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Alice"
              maxLength={32}
              required
              className="w-full bg-[#111120] border border-[#1e1e32] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Your agent&apos;s name <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              value={personaInput}
              onChange={(e) => setPersonaInput(e.target.value)}
              placeholder={nameInput ? `${nameInput}'s Agent` : "e.g. Archie"}
              maxLength={48}
              className="w-full bg-[#111120] border border-[#1e1e32] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Agent mission <span className="text-amber-400/80">(required)</span>
            </label>
            <input
              value={missionInput}
              onChange={(e) => setMissionInput(e.target.value)}
              placeholder="e.g. learn what others care about, or spread good vibes"
              maxLength={120}
              required
              className="w-full bg-[#111120] border border-[#1e1e32] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Personality <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              value={personalityInput}
              onChange={(e) => setPersonalityInput(e.target.value)}
              placeholder="e.g. curious and dry-humored, or warm and encouraging"
              maxLength={80}
              className="w-full bg-[#111120] border border-[#1e1e32] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={!nameInput.trim() || !missionInput.trim()}
            className="w-full mt-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            <Radio className="w-4 h-4" />
            Enter the room
          </button>
        </form>

        <p className="text-center text-xs text-zinc-700 mt-6">
          The selected LLM downloads on first use and is cached in your browser for future visits.
        </p>
      </div>
    </div>
  )
}

function EmptyState({
  modelStatus, loadProgress, modelLabel, webGPUSupported, hasPeers,
}: {
  modelStatus: ModelStatus
  loadProgress: number
  modelLabel: string
  webGPUSupported: boolean | null
  hasPeers: boolean
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-xs">
        {modelStatus === 'loading' ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-violet-900/40 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
            <p className="text-sm font-medium text-zinc-300 mb-1">Loading your agent</p>
            <p className="text-xs text-zinc-600 mb-4">Downloading {modelLabel} to your browser…</p>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full progress-shimmer rounded-full transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <p className="text-xs text-violet-400 mt-2 tabular-nums">{loadProgress}%</p>
          </>
        ) : modelStatus === 'error' ? (
          <>
            <ZapOff className="w-8 h-8 text-rose-400 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">
              {webGPUSupported === false
                ? 'WebGPU not supported — try Chrome 113+ or Edge 113+'
                : 'Failed to load the model. Check the console for details.'}
            </p>
          </>
        ) : modelStatus === 'ready' && !hasPeers ? (
          <>
            <Users className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-400">Waiting for others to join</p>
            <p className="text-xs text-zinc-600 mt-1">Share this page to invite someone — then pair your agents.</p>
          </>
        ) : modelStatus === 'ready' ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-6 h-6 text-violet-400" />
            </div>
            <p className="text-sm font-medium text-zinc-300">Your agent is ready</p>
            <p className="text-xs text-zinc-600 mt-1">Select someone from the sidebar and hit <strong className="text-zinc-400">pair agents</strong>.</p>
          </>
        ) : null}
      </div>
    </div>
  )
}
