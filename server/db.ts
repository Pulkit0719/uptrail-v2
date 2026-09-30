import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2";
import { getDatabaseConnectionOptions } from "./_core/databaseConfig";
import { ENV } from "./_core/env";

let database: ReturnType<typeof drizzle> | null = null;
let pool: Pool | null = null;

// Lazily connect so type checks and unit tests can run without a database.
export async function getDb() {
  if (!database && ENV.databaseUrl) {
    pool = createPool({
      ...getDatabaseConnectionOptions(ENV.databaseUrl, ENV.databaseSslCaFile),
      connectionLimit: ENV.databasePoolSize,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    database = drizzle(pool);
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
