import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "@shared/schema";

const client = createClient({
  url: "file:./stroll.db",
});

export const db = drizzle(client, { schema });
