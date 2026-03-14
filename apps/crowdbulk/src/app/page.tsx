'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Tab = 'submit' | 'worker'

export default function CrowdBulkPage() {
  const [tab, setTab] = useState<Tab>('submit')
  const [email, setEmail] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !file) {
      setErrorMsg('Enter email and choose an Excel file.')
      return
    }
    setSubmitStatus('uploading')
    setErrorMsg('')
    const form = new FormData()
    form.set('email', email.trim())
    form.set('file', file)
    try {
      const res = await fetch('/api/jobs', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setJobId(data.jobId)
      setSubmitStatus('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Upload failed')
      setSubmitStatus('error')
    }
  }, [email, file])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>CrowdBulk</h1>
      <p style={{ color: '#888', marginBottom: '1.5rem' }}>
        Upload an Excel sheet with a <strong>prompt</strong> column. We&apos;ll process it in batches using in-browser LLMs from active visitors. You&apos;ll get an email when it&apos;s done.
      </p>

      <nav style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setTab('submit')}
          style={{ background: tab === 'submit' ? '#333' : 'transparent' }}
        >
          Submit job
        </button>
        <button
          type="button"
          onClick={() => setTab('worker')}
          style={{ background: tab === 'worker' ? '#333' : 'transparent' }}
        >
          Be a worker
        </button>
      </nav>

      {tab === 'submit' && (
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Your email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: '100%', marginBottom: '1rem' }}
          />
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Excel file (must have a column named &quot;prompt&quot;)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ width: '100%', marginBottom: '1rem' }}
          />
          <button type="button" onClick={handleSubmit} disabled={submitStatus === 'uploading'}>
            {submitStatus === 'uploading' ? 'Uploading…' : 'Submit'}
          </button>
          {errorMsg && <p style={{ color: '#f87171', marginTop: '0.75rem' }}>{errorMsg}</p>}
          {submitStatus === 'done' && jobId && (
            <p style={{ color: '#86efac', marginTop: '0.75rem' }}>
              Job <code>{jobId}</code> submitted. We&apos;ll email you when it&apos;s done. You can close this page.
            </p>
          )}
        </div>
      )}

      {tab === 'worker' && <WorkerPanel />}
    </div>
  )
}

function WorkerPanel() {
  const [wsConnected, setWsConnected] = useState(false)
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [loadProgress, setLoadProgress] = useState(0)
  const [batchInfo, setBatchInfo] = useState<string | null>(null)
  const [processedCount, setProcessedCount] = useState(0)
  const [processing, setProcessing] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const engineRef = useRef<unknown>(null)
  const processingRef = useRef(false)

  const requestBatch = useCallback((ws: WebSocket) => {
    if (ws.readyState !== 1 || processingRef.current) return
    ws.send(JSON.stringify({ type: 'request_batch' }))
  }, [])

  const connectWs = useCallback(() => {
    const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`)
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join' }))
      setWsConnected(true)
    }
    ws.onclose = () => setWsConnected(false)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'ready') {
          requestBatch(ws)
        }
        if (msg.type === 'batch') {
          if (msg.idle) {
            setBatchInfo('No jobs in queue. Leave this tab open to help when someone submits.')
            setTimeout(() => requestBatch(ws), 5000)
            return
          }
          if (!msg.rows?.length) {
            setBatchInfo(msg.done ? 'Batch complete.' : 'No rows in this batch.')
            setTimeout(() => requestBatch(ws), 1000)
            return
          }
          setProcessing(true)
          processingRef.current = true
          setBatchInfo(`Processing ${msg.rows.length} prompts…`)
          processBatch(ws, msg.jobId, msg.rows, engineRef.current).then(() => {
            setProcessedCount((c) => c + msg.rows.length)
            setBatchInfo(null)
            setProcessing(false)
            processingRef.current = false
            requestBatch(ws)
          })
        }
        if (msg.type === 'batch_ack') {
          setBatchInfo(null)
          setProcessing(false)
          processingRef.current = false
          requestBatch(ws)
        }
      } catch (_) {}
    }
    wsRef.current = ws
  }, [requestBatch])

  useEffect(() => {
    return () => { wsRef.current?.close() }
  }, [])

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
      if (wsRef.current?.readyState === 1) requestBatch(wsRef.current)
    } catch (err) {
      console.error(err)
      setModelStatus('error')
    }
  }, [])

  return (
    <div>
      <p style={{ color: '#888', marginBottom: '1rem' }}>
        Workers run an LLM in their browser and process batches of ~50 prompts. Keep this tab open to contribute.
      </p>
      {modelStatus === 'idle' && (
        <button type="button" onClick={loadModel}>
          Load model (runs in browser)
        </button>
      )}
      {modelStatus === 'loading' && <p>Loading model… {loadProgress}%</p>}
      {modelStatus === 'error' && <p style={{ color: '#f87171' }}>Model failed to load. Check WebGPU support.</p>}
      {modelStatus === 'ready' && (
        <>
          <button type="button" onClick={() => connectWs()} disabled={wsConnected}>
            {wsConnected ? 'Connected' : 'Connect to queue'}
          </button>
          {wsConnected && <span style={{ marginLeft: '0.5rem', color: '#86efac' }}>• Connected</span>}
          {batchInfo && <p style={{ marginTop: '0.75rem', color: '#888' }}>{batchInfo}</p>}
          {processedCount > 0 && <p style={{ marginTop: '0.5rem' }}>Processed {processedCount} prompts this session.</p>}
        </>
      )}
    </div>
  )
}

async function processBatch(
  ws: WebSocket,
  jobId: string,
  rows: { id: number; row_index: number; prompt: string }[],
  engine: unknown
): Promise<void> {
  if (!engine || ws.readyState !== 1) return
  const e = engine as {
    chat: { completions: { create: (opts: { messages: { role: string; content: string }[]; max_tokens: number }) => Promise<AsyncIterable<{ choices: { message?: { content?: string }; delta?: { content?: string } }[] }>> } }
  }
  const results: { rowId: number; result: string }[] = []
  for (const row of rows) {
    try {
      const stream = await e.chat.completions.create({
        messages: [{ role: 'user', content: row.prompt }],
        max_tokens: 256,
      })
      let text = ''
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? ''
        text += delta
      }
      results.push({ rowId: row.id, result: text.trim() })
    } catch (_) {
      results.push({ rowId: row.id, result: '' })
    }
  }
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'submit_batch', jobId, results }))
  }
}
