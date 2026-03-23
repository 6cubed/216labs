const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer } = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000')
const app = next({ dev })
const handle = app.getRequestHandler()

// In-memory presence store: id -> { ws, name, agentPersona, busyWith }
const clients = new Map()

function broadcast(msg, excludeId) {
  const json = JSON.stringify(msg)
  for (const [id, client] of clients) {
    if (id !== excludeId && client.ws.readyState === 1 /* OPEN */) {
      client.ws.send(json)
    }
  }
}

function getOnlineList() {
  const list = []
  for (const [id, c] of clients) {
    if (c.name) {
      list.push({ id, name: c.name, agentPersona: c.agentPersona, busyWith: c.busyWith || null })
    }
  }
  return list
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  })

  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws) => {
    const id = Math.random().toString(36).slice(2, 10)
    clients.set(id, { ws, name: null, agentPersona: null, busyWith: null })

    ws.send(JSON.stringify({ type: 'connected', id }))

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      if (msg.type === 'join') {
        const client = clients.get(id)
        if (!client) return
        client.name = (msg.name || '').trim().slice(0, 32)
        client.agentPersona = (msg.agentPersona || `${client.name}'s Agent`).trim().slice(0, 48)
        ws.send(JSON.stringify({ type: 'online_users', users: getOnlineList() }))
        broadcast(
          { type: 'user_joined', user: { id, name: client.name, agentPersona: client.agentPersona, busyWith: null } },
          id
        )
      }

      // Route agent message from initiator → responder
      if (msg.type === 'agent_message') {
        const target = clients.get(msg.targetId)
        const sender = clients.get(id)
        if (target?.ws.readyState === 1 && sender?.name) {
          target.ws.send(JSON.stringify({
            type: 'agent_message_incoming',
            fromId: id,
            fromName: sender.name,
            fromAgentPersona: sender.agentPersona,
            message: msg.message,
            conversationId: msg.conversationId,
          }))
        }
      }

      // Route agent response from responder → initiator
      if (msg.type === 'agent_response') {
        const target = clients.get(msg.targetId)
        const sender = clients.get(id)
        if (target?.ws.readyState === 1 && sender?.name) {
          target.ws.send(JSON.stringify({
            type: 'agent_response_incoming',
            fromId: id,
            fromName: sender.name,
            fromAgentPersona: sender.agentPersona,
            message: msg.message,
            conversationId: msg.conversationId,
          }))
        }
      }

      // Update busy status (in conversation or not)
      if (msg.type === 'busy_status') {
        const client = clients.get(id)
        if (!client) return
        client.busyWith = msg.busyWith || null
        broadcast({ type: 'user_busy_update', userId: id, busyWith: client.busyWith }, id)
      }
    })

    ws.on('close', () => {
      const client = clients.get(id)
      if (client?.name) {
        broadcast({ type: 'user_left', userId: id })
      }
      clients.delete(id)
    })

    ws.on('error', () => {
      clients.delete(id)
    })
  })

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
