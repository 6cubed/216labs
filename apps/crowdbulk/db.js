const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = process.env.CROWDBULK_DB_PATH || path.join(__dirname, 'data', 'crowdbulk.db')

let db = null

function getDb() {
  if (!db) {
    const fs = require('fs')
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    initSchema(db)
  }
  return db
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_rows INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS job_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      result TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      worker_id TEXT,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );
    CREATE INDEX IF NOT EXISTS idx_job_rows_job_status ON job_rows(job_id, status);
  `)
}

function createJob(email, rows) {
  const database = getDb()
  const id = require('crypto').randomBytes(8).toString('hex')
  database.transaction(() => {
    database.prepare(
      'INSERT INTO jobs (id, email, status, total_rows) VALUES (?, ?, ?, ?)'
    ).run(id, email, 'pending', rows.length)
    const insertRow = database.prepare(
      'INSERT INTO job_rows (job_id, row_index, prompt) VALUES (?, ?, ?)'
    )
    rows.forEach((prompt, i) => insertRow.run(id, i, String(prompt)))
  })()
  return id
}

function getJob(jobId) {
  return getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(jobId)
}

const BATCH_SIZE = 50

function claimNextBatch(jobId, limit = BATCH_SIZE) {
  const database = getDb()
  let batch = []
  database.transaction(() => {
    batch = database.prepare(
      `SELECT id, row_index, prompt FROM job_rows WHERE job_id = ? AND status = 'pending' ORDER BY row_index LIMIT ?`
    ).all(jobId, limit)
    if (batch.length > 0) {
      const stmt = database.prepare('UPDATE job_rows SET status = ? WHERE id = ?')
      for (const r of batch) stmt.run('processing', r.id)
    }
  })()
  return batch
}

function getNextBatch(jobId, limit = BATCH_SIZE) {
  return getDb().prepare(
    `SELECT id, row_index, prompt FROM job_rows WHERE job_id = ? AND status = 'pending' ORDER BY row_index LIMIT ?`
  ).all(jobId, limit)
}

function submitResults(jobId, results) {
  const database = getDb()
  const stmt = database.prepare(
    'UPDATE job_rows SET result = ?, status = ? WHERE job_id = ? AND id = ?'
  )
  database.transaction(() => {
    for (const { rowId, result } of results) {
      stmt.run(result ?? '', 'done', jobId, rowId)
    }
  })()
}

function getJobProgress(jobId) {
  const row = getDb().prepare(
    `SELECT COUNT(*) as done FROM job_rows WHERE job_id = ? AND status = 'done'`
  ).get(jobId)
  const job = getJob(jobId)
  return { total: job.total_rows, done: row.done, status: job.status }
}

function isJobComplete(jobId) {
  const r = getDb().prepare(
    'SELECT COUNT(*) as pending FROM job_rows WHERE job_id = ? AND status != ?'
  ).get(jobId, 'done')
  return r.pending === 0
}

function setJobComplete(jobId) {
  getDb().prepare('UPDATE jobs SET status = ? WHERE id = ?').run('done', jobId)
}

function getJobResults(jobId) {
  return getDb().prepare(
    'SELECT row_index, prompt, result FROM job_rows WHERE job_id = ? ORDER BY row_index'
  ).all(jobId)
}

function getNextJobWithPendingRows() {
  const row = getDb().prepare(`
    SELECT job_id FROM job_rows WHERE status = 'pending' ORDER BY job_id, row_index LIMIT 1
  `).get()
  return row?.job_id ?? null
}

module.exports = {
  getDb,
  createJob,
  getJob,
  getNextBatch,
  claimNextBatch,
  submitResults,
  getJobProgress,
  isJobComplete,
  setJobComplete,
  getJobResults,
  getNextJobWithPendingRows,
}
