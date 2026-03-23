import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const DATA_DIR = process.env.MYSTERYSHOPPER_DATA_DIR || process.env.DATA_DIR || join(process.cwd(), 'data')
const UPLOADS_DIR = join(DATA_DIR, 'uploads')
const STORES_FILE = join(DATA_DIR, 'stores.json')
const SHELFIES_FILE = join(DATA_DIR, 'shelfies.json')

export interface Store {
  id: string
  name: string
  createdAt: string
}

export interface Shelfie {
  id: string
  storeId: string
  storeName: string
  filename: string
  caption: string
  createdAt: string
}

async function ensureDir(path: string) {
  try {
    await mkdir(path, { recursive: true })
  } catch {
    // ignore
  }
}

export async function getStores(): Promise<Store[]> {
  await ensureDir(DATA_DIR)
  try {
    const raw = await readFile(STORES_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function addStore(name: string): Promise<Store> {
  await ensureDir(DATA_DIR)
  const list = await getStores()
  const id = `store_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const store: Store = { id, name: name.trim().slice(0, 200), createdAt: new Date().toISOString() }
  list.push(store)
  await writeFile(STORES_FILE, JSON.stringify(list, null, 0), 'utf-8')
  return store
}

export async function getShelfies(): Promise<Shelfie[]> {
  await ensureDir(DATA_DIR)
  try {
    const raw = await readFile(SHELFIES_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function addShelfie(s: Omit<Shelfie, 'createdAt'>): Promise<void> {
  await ensureDir(DATA_DIR)
  const list = await getShelfies()
  const withDate = { ...s, createdAt: new Date().toISOString() }
  list.unshift(withDate)
  await writeFile(SHELFIES_FILE, JSON.stringify(list, null, 0), 'utf-8')
}

export function getUploadsDir(): string {
  return UPLOADS_DIR
}

export async function ensureUploadsDir(): Promise<void> {
  await ensureDir(UPLOADS_DIR)
}
