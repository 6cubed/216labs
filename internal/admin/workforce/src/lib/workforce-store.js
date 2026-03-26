import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";

const STORE_PATH =
  process.env.WORKFORCE_STORE_PATH || "/app/data/workforce-employees.json";

function normalizeToken(token) {
  return token.trim();
}

function loadStore() {
  if (!existsSync(STORE_PATH)) {
    return { employees: [] };
  }
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.employees)) return { employees: [] };
    return parsed;
  } catch {
    return { employees: [] };
  }
}

function saveStore(data) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function listEmployees() {
  const store = loadStore();
  return [...store.employees].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createEmployee(input) {
  const name = input.name?.trim() || "";
  const role = input.role?.trim() || "";
  const notes = input.notes?.trim() || "";
  const botToken = normalizeToken(input.botToken || "");

  if (!name) return { ok: false, error: "Employee name is required." };
  if (!role) return { ok: false, error: "Role is required." };
  if (!botToken) {
    return { ok: false, error: "Telegram bot token is required." };
  }

  const store = loadStore();
  const duplicate = store.employees.find(
    (employee) =>
      normalizeToken(employee.telegramBotToken).toLowerCase() === botToken.toLowerCase()
  );

  if (duplicate) {
    return {
      ok: false,
      error: "Telegram bot token must be unique. This token is already assigned.",
    };
  }

  const employee = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    role,
    notes,
    telegramBotToken: botToken,
    createdAt: new Date().toISOString(),
  };

  store.employees.push(employee);
  saveStore(store);
  return { ok: true, employee };
}

export function getStorePathForDebug() {
  return join(STORE_PATH);
}
