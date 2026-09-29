import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2";
import { ENV } from "./_core/env";

let database: ReturnType<typeof drizzle> | null = null;
let pool: Pool | null = null;

// Lazily connect so type checks and unit tests can run without a database.
export async function getDb() {
  if (!database && ENV.databaseUrl) {
    try {
      pool = createPool({
        uri: ENV.databaseUrl,
        connectionLimit: ENV.databasePoolSize,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });
      database = drizzle(pool);
    } catch {
      console.warn("[Database] Failed to initialize the connection pool");
      database = null;
    }
  }
  return database;
}

export async function closeDb() {
  const currentPool = pool;
  database = null;
  pool = null;
  if (currentPool) {
    await new Promise<void>((resolve, reject) => currentPool.end(error => error ? reject(error) : resolve()));
  }
}
