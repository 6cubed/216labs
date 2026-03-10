'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, Zap, ZapOff, Users, MessageSquare, Radio, X, ChevronRight, Cpu, Wifi, Brain, ChevronDown, ChevronUp } from 'lucide-react'

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

interface MonologueEntry {
  content: string
  context: string
  timestamp: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TURNS = 6
const MAX_CONCURRENT_CONVERSATIONS = 5
const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'

// Pending reply item for round-robin queue (reply to someone, or opening message)
type PendingReply =
  | { type: 'reply'; convId: string; messages: ConvMessage[]; theirMessage: string; theirAgentName: string; peerId: string; isAgent_message: boolean }
  | { type: 'opening'; convId: string; peerId: string; peerAgentPersona: string }

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

  // ── Model state ───────────────────────────────────────────────────────────
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [loadProgress, setLoadProgress] = useState(0)
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null)
  const engineRef = useRef<unknown>(null)

  // ── Conversation state ────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Record<string, Conversation>>({})
  const conversationsRef = useRef<Record<string, Conversation>>({})
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const replyQueueRef = useRef<PendingReply[]>([])
  const isProcessingRef = useRef<boolean>(false)
  const advanceTurnRef = useRef<(convId: string, theirMessage: string, theirAgentName: string, peerId: string, isAgent_message: boolean) => void>(() => {})
  const processReplyQueueRef = useRef<() => void>(() => {})

  // Internal monologue (agent thinks before each reply)
  const [internalMonologue, setInternalMonologue] = useState<MonologueEntry[]>([])
  const [monologueOpen, setMonologueOpen] = useState(false)

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
  const loadModel = useCallback(async () => {
    setModelStatus('loading')
    setLoadProgress(0)
    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
      const engine = await CreateMLCEngine(MODEL_ID, {
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
  }, [])

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
      "You are having a fun, brief conversation with another user's AI agent. Be friendly, curious, and concise — 2 sentences max per reply."
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

  // ── Internal monologue (one short thought before replying) ─────────────────
  const generateMonologueEntry = useCallback(async (context: string): Promise<string> => {
    const engine = engineRef.current as {
      chat: { completions: { create: (opts: unknown) => Promise<AsyncIterable<{ choices: { delta: { content?: string } }[] }>> } }
    } | null
    if (!engine) return ''
    const persona = myAgentPersonaRef.current
    const personality = myPersonalityRef.current
    const mission = myMissionRef.current
    const twist = myTwistRef.current
    const monologueSystem = buildSystemPrompt(
      persona,
      personality,
      mission,
      twist,
      'Think to yourself in one short sentence before replying. Internal thought only — do not address anyone.'
    )
    try {
      const stream = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: monologueSystem },
          { role: 'user', content: context },
        ],
        max_tokens: 60,
        temperature: 0.7,
        stream: true,
      })
      let full = ''
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || ''
        full += token
      }
      return full.trim() || ''
    } catch {
      return ''
    }
  }, [])

  // ── WebSocket send helper ─────────────────────────────────────────────────
  const sendWS = useCallback((msg: object) => {
    wsRef.current?.send(JSON.stringify(msg))
  }, [])

  // ── Round-robin reply queue: monologue once, then reply ─────────────────────
  const processReplyQueue = useCallback(() => {
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

    const runAfterMonologue = () => {
      if (item.type === 'opening') {
        const openingPrompt = `Say hello to ${item.peerAgentPersona} and introduce yourself briefly. Start the conversation.`
        generateAndStream(item.convId, [], openingPrompt, (response) => {
          setConversations((prev) => {
            const conv = prev[item.convId]
            if (!conv || conv.status === 'ended') return prev
            const updated: Conversation = { ...conv, turnCount: 1, isMyTurn: false }
            return { ...prev, [item.convId]: updated }
          })
          sendWS({ type: 'agent_message', targetId: item.peerId, message: response, conversationId: item.convId })
          isProcessingRef.current = false
          processReplyQueue()
        })
      } else {
        generateAndStream(item.convId, item.messages, item.theirMessage, (response) => {
          let willEnd = false
          let sendMsgType: string | null = null
          setConversations((prev) => {
            const afterGenConv = prev[item.convId]
            if (!afterGenConv || afterGenConv.status === 'ended') {
              willEnd = true
              return prev
            }
            const finalTurnCount = afterGenConv.turnCount + 1
            if (finalTurnCount >= MAX_TURNS) {
              willEnd = true
              const endedConv = { ...afterGenConv, isMyTurn: false, turnCount: finalTurnCount, status: 'ended' as const }
              return { ...prev, [item.convId]: endedConv }
            }
            sendMsgType = item.isAgent_message ? 'agent_response' : 'agent_message'
            const nextConv: Conversation = { ...afterGenConv, isMyTurn: false, turnCount: finalTurnCount }
            return { ...prev, [item.convId]: nextConv }
          })
          if (willEnd) {
            setTimeout(() => {
              const active = Object.values(conversationsRef.current).filter((c) => c.status === 'active')
              sendWS({ type: 'busy_status', busyWith: active[0]?.id ?? null })
            }, 0)
          } else if (sendMsgType) {
            sendWS({ type: sendMsgType, targetId: item.peerId, message: response, conversationId: item.convId })
          }
          isProcessingRef.current = false
          processReplyQueue()
        })
      }
    }

    const context = item.type === 'opening'
      ? `About to introduce yourself to ${item.peerAgentPersona}.`
      : `About to reply to ${item.theirAgentName} who said: "${item.theirMessage.slice(0, 120)}${item.theirMessage.length > 120 ? '…' : ''}"`
    generateMonologueEntry(context).then((thought) => {
      setInternalMonologue((prev) => [
        ...prev,
        { content: thought || '…', context, timestamp: Date.now() },
      ])
      runAfterMonologue()
    }).catch(() => {
      setInternalMonologue((prev) => [...prev, { content: '…', context, timestamp: Date.now() }])
      runAfterMonologue()
    })
  }, [generateAndStream, generateMonologueEntry, sendWS])

  // ── Advance conversation turn (enqueue reply; round-robin) ──────────────────
  const advanceTurn = useCallback((
    convId: string,
    theirMessage: string,
    theirAgentName: string,
    peerId: string,
    isAgent_message: boolean,
  ) => {
    const theirEntry: ConvMessage = {
      speaker: 'theirs',
      agentName: theirAgentName,
      content: theirMessage,
      timestamp: Date.now(),
    }

    setConversations((prev) => {
      const conv = prev[convId]
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
      })
      return { ...prev, [convId]: updatedConv }
    })
    setTimeout(() => processReplyQueueRef.current(), 0)
  }, [processReplyQueue])

  useEffect(() => { advanceTurnRef.current = advanceTurn }, [advanceTurn])
  useEffect(() => { processReplyQueueRef.current = processReplyQueue }, [processReplyQueue])

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
          // New conversation from peer — only update state; ref is synced by useEffect
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
        } else {
          // Existing conversation: ensure friend is looking at this thread
          setActiveConvId(convId)
        }

        // Use ref so we always call latest advanceTurn (effect has [] deps)
        setTimeout(() => {
          advanceTurnRef.current(convId, msg.message, msg.fromAgentPersona, msg.fromId, true)
        }, 300)
      }

      // Response to our message: remote is responding, we are the initiator
      if (msg.type === 'agent_response_incoming') {
        const convId: string = msg.conversationId
        setActiveConvId(convId) // Ensure we're viewing this conversation
        setTimeout(() => {
          advanceTurnRef.current(convId, msg.message, msg.fromAgentPersona, msg.fromId, false)
        }, 300)
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
    setTimeout(processReplyQueue, 0)
  }, [modelStatus, processReplyQueue, sendWS])

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
    sendWS({ type: 'join', name, agentPersona: persona })
    loadModel()
  }, [nameInput, personaInput, personalityInput, missionInput, sendWS, loadModel])

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

        <ModelStatusBadge status={modelStatus} progress={loadProgress} />

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
          {/* Internal monologue (collapsible) */}
          <div className="shrink-0 border-b border-[#1e1e32]">
            <button
              type="button"
              onClick={() => setMonologueOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#111120] transition-colors"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                <Brain className="w-3.5 h-3.5 text-amber-500/80" />
                Internal monologue
                {internalMonologue.length > 0 && (
                  <span className="text-zinc-600 normal-case font-normal">({internalMonologue.length})</span>
                )}
              </span>
              {monologueOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
            </button>
            {monologueOpen && (
              <div className="max-h-40 overflow-y-auto px-4 pb-3 space-y-2 border-t border-[#1e1e32] pt-2">
                {internalMonologue.length === 0 ? (
                  <p className="text-xs text-zinc-600">One thought will appear here before each reply.</p>
                ) : (
                  internalMonologue.map((entry, i) => (
                    <div key={`${entry.timestamp}-${i}`} className="text-xs rounded-lg bg-amber-950/30 border border-amber-800/30 px-3 py-2 text-amber-200/90">
                      <p className="leading-relaxed">{entry.content}</p>
                      <p className="mt-1 text-amber-600/80 truncate">{entry.context}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

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

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
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
            </>
          ) : (
            <EmptyState
              modelStatus={modelStatus}
              loadProgress={loadProgress}
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

function ModelStatusBadge({ status, progress }: { status: ModelStatus; progress: number }) {
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
    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
      <Zap className="w-3.5 h-3.5" />
      <span>agent ready</span>
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
  nameInput, setNameInput, personaInput, setPersonaInput, personalityInput, setPersonalityInput, missionInput, setMissionInput, webGPUSupported, onJoin,
}: {
  nameInput: string
  setNameInput: (v: string) => void
  personaInput: string
  setPersonaInput: (v: string) => void
  personalityInput: string
  setPersonalityInput: (v: string) => void
  missionInput: string
  setMissionInput: (v: string) => void
  webGPUSupported: boolean | null
  onJoin: (e: React.FormEvent) => void
}) {
  return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
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
          The LLM ({MODEL_ID.split('-').slice(0, 3).join(' ')}) downloads to your browser on first use (~800 MB).
        </p>
      </div>
    </div>
  )
}

function EmptyState({
  modelStatus, loadProgress, webGPUSupported, hasPeers,
}: {
  modelStatus: ModelStatus
  loadProgress: number
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
            <p className="text-xs text-zinc-600 mb-4">Downloading Llama 3.2 1B to your browser…</p>
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
