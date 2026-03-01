import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "@shared/schema";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./sqlite.db",
});

export const db = drizzle(client, { schema });
