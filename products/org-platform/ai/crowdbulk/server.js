const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const express = require('express')
const multer = require('multer')
const { WebSocketServer } = require('ws')
const XLSX = require('xlsx')
const db = require('./db')
const { sendJobComplete } = require('./lib/email')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000')
const app = next({ dev })
const handle = app.getRequestHandler()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
const PROMPT_COLUMNS = ['prompt', 'Prompt', 'PROMPT']

function getPromptColumn(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  const firstRow = sheet[XLSX.utils.encode_cell({ r: 0, c: 0 })]
  if (!firstRow) return null
  for (let c = 0; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })]
    const val = cell?.w || cell?.v
    if (val && PROMPT_COLUMNS.includes(String(val).trim())) return c
  }
  return 0
}

function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  const col = getPromptColumn(sheet)
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  const prompts = []
  for (let r = 1; r <= range.e.r; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: col })]
    const v = cell?.w ?? cell?.v
    if (v != null && String(v).trim()) prompts.push(String(v).trim())
  }
  return prompts
}

// Workers: id -> { ws, busyWith: jobId | null }
const workers = new Map()

function getBaseUrl(req) {
  const host = req.get('host') || req.get('x-forwarded-host')
  const proto = req.get('x-forwarded-proto') || (req.connection?.encrypted ? 'https' : 'http')
  return host ? `${proto}://${host}` : null
}

app.prepare().then(() => {
  const expressApp = express()
  expressApp.use(express.json())

  expressApp.post('/api/jobs', upload.single('file'), (req, res) => {
    const email = (req.body?.email || req.body?.e || '').toString().trim()
    if (!email) {
      return res.status(400).json({ error: 'email required' })
    }
    const file = req.file
    if (!file?.buffer) {
      return res.status(400).json({ error: 'file required' })
    }
    let prompts
    try {
      prompts = parseExcel(file.buffer)
    } catch (e) {
      return res.status(400).json({ error: 'Invalid Excel or no prompt column' })
    }
    if (prompts.length === 0) {
      return res.status(400).json({ error: 'No rows with prompts found' })
    }
    if (prompts.length > 10000) {
      return res.status(400).json({ error: 'Max 10000 rows' })
    }
    const jobId = db.createJob(email, prompts)
    res.json({ jobId, totalRows: prompts.length })
  })

  expressApp.get('/api/jobs/:id', (req, res) => {
    const job = db.getJob(req.params.id)
    if (!job) return res.status(404).json({ error: 'Job not found' })
    const progress = db.getJobProgress(req.params.id)
    res.json({ ...job, ...progress })
  })

  expressApp.get('/api/jobs/:id/results', (req, res) => {
    const job = db.getJob(req.params.id)
    if (!job) return res.status(404).json({ error: 'Job not found' })
    if (job.status !== 'done') return res.status(400).json({ error: 'Job not complete' })
    const rows = db.getJobResults(req.params.id)
    const wb = XLSX.utils.book_new()
    const data = [['row_index', 'prompt', 'result']]
    rows.forEach((r) => data.push([r.row_index, r.prompt, r.result]))
    const sheet = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, sheet, 'Results')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Disposition', `attachment; filename="crowdbulk-${req.params.id}.xlsx"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(buf)
  })

  expressApp.get('*', (req, res) => {
    handle(req, res, parse(req.url, true))
  })

  const server = createServer(expressApp)
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws, req) => {
    const id = Math.random().toString(36).slice(2, 10)
    workers.set(id, { ws, busyWith: null })

    ws.send(JSON.stringify({ type: 'connected', id }))

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      if (msg.type === 'join') {
        ws.send(JSON.stringify({ type: 'ready', workerId: id }))
      }

      if (msg.type === 'request_batch') {
        const worker = workers.get(id)
        if (!worker || worker.busyWith) return
        const jobId = msg.jobId || db.getNextJobWithPendingRows()
        if (!jobId) {
          ws.send(JSON.stringify({ type: 'batch', jobId: null, rows: [], done: true, idle: true }))
          return
        }
        const job = db.getJob(jobId)
        if (!job || job.status === 'done') {
          ws.send(JSON.stringify({ type: 'batch', jobId, rows: [], done: true }))
          return
        }
        const batch = db.claimNextBatch(jobId)
        if (batch.length === 0) {
          const progress = db.getJobProgress(jobId)
          const done = db.isJobComplete(jobId)
          if (done) {
            db.setJobComplete(jobId)
            const baseUrl = req.url ? null : getBaseUrl({ get: () => null })
            sendJobComplete(job.email, jobId, process.env.CROWDBULK_BASE_URL || baseUrl)
          }
          ws.send(JSON.stringify({ type: 'batch', jobId, rows: [], done: true, progress }))
          return
        }
        worker.busyWith = jobId
        ws.send(JSON.stringify({
          type: 'batch',
          jobId,
          rows: batch.map((r) => ({ id: r.id, row_index: r.row_index, prompt: r.prompt })),
          done: false,
        }))
      }

      if (msg.type === 'submit_batch') {
        const worker = workers.get(id)
        if (!worker) return
        const { jobId, results } = msg
        if (jobId && Array.isArray(results)) {
          db.submitResults(jobId, results)
          worker.busyWith = null
          const progress = db.getJobProgress(jobId)
          const done = db.isJobComplete(jobId)
          if (done) {
            db.setJobComplete(jobId)
            const job = db.getJob(jobId)
            if (job) {
              sendJobComplete(job.email, jobId, process.env.CROWDBULK_BASE_URL)
            }
          }
          ws.send(JSON.stringify({ type: 'batch_ack', jobId, progress, done }))
        }
      }
    })

    ws.on('close', () => { workers.delete(id) })
    ws.on('error', () => { workers.delete(id) })
  })

  server.listen(port, () => {
    console.log(`> CrowdBulk ready on http://localhost:${port}`)
  })
})
