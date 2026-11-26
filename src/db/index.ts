import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string) {
  const client = postgres(url, { max: 10, prepare: false });
  return { db: drizzle(client, { schema }), client };
}

export type Db = ReturnType<typeof createDb>["db"];

const globalForDb = globalThis as unknown as { __db?: Db };

/** Lazily-created shared connection (reused across dev hot reloads). */
export function getDb(): Db {
  if (!globalForDb.__db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
    globalForDb.__db = createDb(url).db;
  }
  return globalForDb.__db;
}
