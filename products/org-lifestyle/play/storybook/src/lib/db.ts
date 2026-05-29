import Database from "better-sqlite3";
import { existsSync, mkdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";

/** Resolve at connection time — Next standalone can load route chunks before cwd/env are final. */
function resolveDataDir(): string {
  return process.env.DATA_DIR?.trim() || join(process.cwd(), "data");
}

function resolveDbPath(): string {
  const dataDir = resolveDataDir();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, "storybook.db");
}

export interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
  imageUrl: string | null;
}

export interface Story {
  id: string;
  title: string;
  subtitle: string;
  childName: string;
  age: number;
  topic: string;
  pages: StoryPage[];
  createdAt: string;
}

export interface Order {
  id: string;
  bookId: string;
  stripeSessionId: string;
  status: "pending" | "paid" | "fulfilled";
  customerEmail: string | null;
  customerName: string | null;
  shippingAddress: string | null;
  createdAt: string;
}

let _db: Database.Database | null = null;
let _dbPath: string | null = null;

/** Drop corrupt zero-byte DB files (can appear after volume mount before first write). */
function ensureDbFileReady(dbPath: string): void {
  if (!existsSync(dbPath)) return;
  try {
    if (statSync(dbPath).size === 0) {
      unlinkSync(dbPath);
    }
  } catch {
    /* ignore */
  }
}

/** Called on server boot so print-interest / orders tables exist before first request. */
export function warmDb(): void {
  getDb();
}

export function getDb(): Database.Database {
  const dbPath = resolveDbPath();
  if (_db && _dbPath === dbPath) {
    return _db;
  }
  if (_db) {
    try {
      _db.close();
    } catch {
      /* ignore */
    }
    _db = null;
  }
  ensureDbFileReady(dbPath);
  _db = new Database(dbPath);
  _dbPath = dbPath;
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      child_name TEXT NOT NULL DEFAULT '',
      age INTEGER NOT NULL,
      topic TEXT NOT NULL,
      pages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      stripe_session_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      customer_email TEXT,
      customer_name TEXT,
      shipping_address TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS print_interest (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books(id)
    );
    CREATE INDEX IF NOT EXISTS idx_print_interest_book ON print_interest(book_id);
  `);
  ensurePrintInterestUtmColumns(db);
  ensureLandingWaitlistBook(db);
}

/** Placeholder book for homepage / 6cubed.app waitlist signups (no generated story yet). */
export const LANDING_WAITLIST_BOOK_ID = "__landing_waitlist__";

function ensureLandingWaitlistBook(db: Database.Database): void {
  const row = db.prepare("SELECT 1 FROM books WHERE id = ? LIMIT 1").get(LANDING_WAITLIST_BOOK_ID);
  if (row) return;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO books (id, title, subtitle, child_name, age, topic, pages, created_at)
     VALUES (?, ?, '', '', 0, '', '[]', ?)`
  ).run(LANDING_WAITLIST_BOOK_ID, "6cubed landing waitlist", now);
}

function ensurePrintInterestUtmColumns(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(print_interest)").all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("utm_source")) db.exec("ALTER TABLE print_interest ADD COLUMN utm_source TEXT");
  if (!names.has("utm_medium")) db.exec("ALTER TABLE print_interest ADD COLUMN utm_medium TEXT");
  if (!names.has("utm_campaign")) db.exec("ALTER TABLE print_interest ADD COLUMN utm_campaign TEXT");
}

export interface PrintInterest {
  id: number;
  bookId: string;
  email: string;
  createdAt: string;
  bookTitle: string;
  bookChildName: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export type PrintInterestUtm = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export function createPrintInterest(
  bookId: string,
  email: string,
  utm?: PrintInterestUtm
): void {
  getDb()
    .prepare(
      `INSERT INTO print_interest
       (book_id, email, created_at, utm_source, utm_medium, utm_campaign)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      bookId,
      email.trim().toLowerCase(),
      new Date().toISOString(),
      utm?.utmSource?.trim() || null,
      utm?.utmMedium?.trim() || null,
      utm?.utmCampaign?.trim() || null
    );
}

/** Distinct waitlist rows (print-interest signups). Safe to expose as a public count. */
export function countPrintInterests(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM print_interest")
    .get() as { n: number };
  return row.n ?? 0;
}

export function getAllPrintInterests(): PrintInterest[] {
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.book_id, p.email, p.created_at,
              p.utm_source, p.utm_medium, p.utm_campaign,
              b.title AS book_title, b.child_name AS book_child_name
       FROM print_interest p
       LEFT JOIN books b ON p.book_id = b.id
       ORDER BY p.created_at DESC
       LIMIT 200`
    )
    .all() as Array<{
      id: number;
      book_id: string;
      email: string;
      created_at: string;
      book_title: string | null;
      book_child_name: string | null;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
    }>;

  return rows.map((r) => ({
    id: r.id,
    bookId: r.book_id,
    email: r.email,
    createdAt: r.created_at,
    bookTitle: r.book_title ?? "—",
    bookChildName: r.book_child_name ?? "",
    utmSource: r.utm_source,
    utmMedium: r.utm_medium,
    utmCampaign: r.utm_campaign,
  }));
}

export function saveBook(story: Story): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO books
       (id, title, subtitle, child_name, age, topic, pages, created_at)
       VALUES (@id, @title, @subtitle, @childName, @age, @topic, @pages, @createdAt)`
    )
    .run({
      ...story,
      pages: JSON.stringify(story.pages),
    });
}

export function getBook(id: string): Story | null {
  const row = getDb()
    .prepare("SELECT * FROM books WHERE id = ?")
    .get(id) as
    | {
        id: string;
        title: string;
        subtitle: string;
        child_name: string;
        age: number;
        topic: string;
        pages: string;
        created_at: string;
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    childName: row.child_name,
    age: row.age,
    topic: row.topic,
    pages: JSON.parse(row.pages) as StoryPage[],
    createdAt: row.created_at,
  };
}

export function createOrder(order: Omit<Order, "createdAt">): void {
  getDb()
    .prepare(
      `INSERT INTO orders
       (id, book_id, stripe_session_id, status, customer_email, customer_name, shipping_address, created_at)
       VALUES (@id, @bookId, @stripeSessionId, @status, @customerEmail, @customerName, @shippingAddress, @createdAt)`
    )
    .run({ ...order, createdAt: new Date().toISOString() });
}

export function updateOrderStatus(
  stripeSessionId: string,
  status: Order["status"],
  customerEmail?: string,
  customerName?: string,
  shippingAddress?: string
): void {
  getDb()
    .prepare(
      `UPDATE orders SET status = ?, customer_email = COALESCE(?, customer_email),
       customer_name = COALESCE(?, customer_name),
       shipping_address = COALESCE(?, shipping_address)
       WHERE stripe_session_id = ?`
    )
    .run(
      status,
      customerEmail ?? null,
      customerName ?? null,
      shippingAddress ?? null,
      stripeSessionId
    );
}

export interface OrderWithBook extends Order {
  bookTitle: string;
  bookChildName: string;
  bookAge: number;
}

export function getAllOrders(): OrderWithBook[] {
  const rows = getDb()
    .prepare(
      `SELECT o.*, b.title AS book_title, b.child_name AS book_child_name, b.age AS book_age
       FROM orders o
       LEFT JOIN books b ON o.book_id = b.id
       ORDER BY o.created_at DESC`
    )
    .all() as Array<{
      id: string;
      book_id: string;
      stripe_session_id: string;
      status: string;
      customer_email: string | null;
      customer_name: string | null;
      shipping_address: string | null;
      created_at: string;
      book_title: string | null;
      book_child_name: string | null;
      book_age: number | null;
    }>;

  return rows.map((row) => ({
    id: row.id,
    bookId: row.book_id,
    stripeSessionId: row.stripe_session_id,
    status: row.status as Order["status"],
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    shippingAddress: row.shipping_address,
    createdAt: row.created_at,
    bookTitle: row.book_title ?? "Unknown",
    bookChildName: row.book_child_name ?? "",
    bookAge: row.book_age ?? 0,
  }));
}

export function setOrderStatus(orderId: string, status: Order["status"]): void {
  getDb()
    .prepare("UPDATE orders SET status = ? WHERE id = ?")
    .run(status, orderId);
}

export function getOrderBySession(stripeSessionId: string): Order | null {
  const row = getDb()
    .prepare("SELECT * FROM orders WHERE stripe_session_id = ?")
    .get(stripeSessionId) as
    | {
        id: string;
        book_id: string;
        stripe_session_id: string;
        status: string;
        customer_email: string | null;
        customer_name: string | null;
        shipping_address: string | null;
        created_at: string;
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    bookId: row.book_id,
    stripeSessionId: row.stripe_session_id,
    status: row.status as Order["status"],
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    shippingAddress: row.shipping_address,
    createdAt: row.created_at,
  };
}
