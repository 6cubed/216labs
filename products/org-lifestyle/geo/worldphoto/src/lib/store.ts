import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const DATA_DIR = process.env.WORLDPHOTO_DATA_DIR || process.env.DATA_DIR || join(process.cwd(), 'data')
const UPLOADS_DIR = join(DATA_DIR, 'uploads')
const SUBMISSIONS_FILE = join(DATA_DIR, 'submissions.json')

export interface Submission {
  id: string
  lat: number
  lng: number
  caption: string
  filename: string
  createdAt: string
}

async function ensureDir(path: string) {
  try {
    await mkdir(path, { recursive: true })
  } catch {
    // ignore
  }
}

export async function getSubmissions(): Promise<Submission[]> {
  await ensureDir(DATA_DIR)
  try {
    const raw = await readFile(SUBMISSIONS_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function addSubmission(s: Omit<Submission, 'createdAt'>): Promise<void> {
  await ensureDir(DATA_DIR)
  const list = await getSubmissions()
  const withDate = { ...s, createdAt: new Date().toISOString() }
  list.unshift(withDate)
  await writeFile(SUBMISSIONS_FILE, JSON.stringify(list, null, 0), 'utf-8')
}

export function getUploadsDir(): string {
  return UPLOADS_DIR
}

export async function ensureUploadsDir(): Promise<void> {
  await ensureDir(UPLOADS_DIR)
}
