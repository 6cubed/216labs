import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "aiart.db");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

export interface Order {
  id: string;
  printId: string;
  stripeSessionId: string;
  status: "pending" | "paid" | "fulfilled";
  customerEmail: string | null;
  customerName: string | null;
  shippingAddress: string | null;
  createdAt: string;
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      print_id TEXT NOT NULL,
      stripe_session_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      customer_email TEXT,
      customer_name TEXT,
      shipping_address TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export function createOrder(order: Omit<Order, "createdAt">): void {
  getDb()
    .prepare(
      `INSERT INTO orders
       (id, print_id, stripe_session_id, status, customer_email, customer_name, shipping_address, created_at)
       VALUES (@id, @printId, @stripeSessionId, @status, @customerEmail, @customerName, @shippingAddress, @createdAt)`
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
      `UPDATE orders SET status = ?,
       customer_email = COALESCE(?, customer_email),
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

export function getOrderBySession(stripeSessionId: string): Order | null {
  const row = getDb()
    .prepare("SELECT * FROM orders WHERE stripe_session_id = ?")
    .get(stripeSessionId) as
    | {
        id: string;
        print_id: string;
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
    printId: row.print_id,
    stripeSessionId: row.stripe_session_id,
    status: row.status as Order["status"],
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    shippingAddress: row.shipping_address,
    createdAt: row.created_at,
  };
}
