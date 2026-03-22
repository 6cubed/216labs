import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "valentine.db");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

export interface ValentineCard {
  id: string;
  title: string;
  insideMessage: string;
  recipientName: string;
  idea: string;
  tone: string;
  imagePrompt: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  cardId: string;
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
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      inside_message TEXT NOT NULL,
      recipient_name TEXT NOT NULL DEFAULT '',
      idea TEXT NOT NULL,
      tone TEXT NOT NULL DEFAULT 'romantic',
      image_prompt TEXT NOT NULL,
      image_url TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      stripe_session_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      customer_email TEXT,
      customer_name TEXT,
      shipping_address TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    );
  `);
}

export function saveCard(card: ValentineCard): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO cards
       (id, title, inside_message, recipient_name, idea, tone, image_prompt, image_url, created_at)
       VALUES (@id, @title, @insideMessage, @recipientName, @idea, @tone, @imagePrompt, @imageUrl, @createdAt)`
    )
    .run({
      ...card,
    });
}

export function updateCardImage(cardId: string, imageUrl: string): void {
  getDb()
    .prepare("UPDATE cards SET image_url = ? WHERE id = ?")
    .run(imageUrl, cardId);
}

export function getCard(id: string): ValentineCard | null {
  const row = getDb()
    .prepare("SELECT * FROM cards WHERE id = ?")
    .get(id) as
    | {
        id: string;
        title: string;
        inside_message: string;
        recipient_name: string;
        idea: string;
        tone: string;
        image_prompt: string;
        image_url: string | null;
        created_at: string;
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    insideMessage: row.inside_message,
    recipientName: row.recipient_name,
    idea: row.idea,
    tone: row.tone,
    imagePrompt: row.image_prompt,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  };
}

export function createOrder(order: Omit<Order, "createdAt">): void {
  getDb()
    .prepare(
      `INSERT INTO orders
       (id, card_id, stripe_session_id, status, customer_email, customer_name, shipping_address, created_at)
       VALUES (@id, @cardId, @stripeSessionId, @status, @customerEmail, @customerName, @shippingAddress, @createdAt)`
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

export interface OrderWithCard extends Order {
  cardTitle: string;
  cardRecipient: string;
}

export function getAllOrders(): OrderWithCard[] {
  const rows = getDb()
    .prepare(
      `SELECT o.*, c.title AS card_title, c.recipient_name AS card_recipient
       FROM orders o
       LEFT JOIN cards c ON o.card_id = c.id
       ORDER BY o.created_at DESC`
    )
    .all() as Array<{
      id: string;
      card_id: string;
      stripe_session_id: string;
      status: string;
      customer_email: string | null;
      customer_name: string | null;
      shipping_address: string | null;
      created_at: string;
      card_title: string | null;
      card_recipient: string | null;
    }>;

  return rows.map((row) => ({
    id: row.id,
    cardId: row.card_id,
    stripeSessionId: row.stripe_session_id,
    status: row.status as Order["status"],
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    shippingAddress: row.shipping_address,
    createdAt: row.created_at,
    cardTitle: row.card_title ?? "Unknown",
    cardRecipient: row.card_recipient ?? "",
  }));
}

export function setOrderStatus(orderId: string, status: Order["status"]): void {
  getDb().prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
}

export function getOrderBySession(stripeSessionId: string): Order | null {
  const row = getDb()
    .prepare("SELECT * FROM orders WHERE stripe_session_id = ?")
    .get(stripeSessionId) as
    | {
        id: string;
        card_id: string;
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
    cardId: row.card_id,
    stripeSessionId: row.stripe_session_id,
    status: row.status as Order["status"],
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    shippingAddress: row.shipping_address,
    createdAt: row.created_at,
  };
}
