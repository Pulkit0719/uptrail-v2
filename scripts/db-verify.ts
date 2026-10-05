import "dotenv/config";
import { sql } from "drizzle-orm";
import { ENV } from "../server/_core/env";
import { redactDatabaseError } from "../server/_core/databaseConfig";
import { closeDb, getDb } from "../server/db";

try {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required");
  await db.execute(sql`SELECT 1`);
  const [tlsRows] = await db.execute(sql`SHOW SESSION STATUS WHERE Variable_name IN ('Ssl_cipher', 'Ssl_version')`);
  const tlsStatus = new Map(
    (tlsRows as Array<{ Variable_name: string; Value: string }>).map(row => [row.Variable_name, row.Value]),
  );
  const tlsCipher = tlsStatus.get("Ssl_cipher") ?? "";
  const tlsVersion = tlsStatus.get("Ssl_version") ?? "";
  if (!tlsCipher || !tlsVersion) throw new Error("Database connection is not using TLS");
  const [tables] = await db.execute(sql`
    SELECT COUNT(*) AS tableCount
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `);
  const count = (tables as Array<{ tableCount: number }>)[0]?.tableCount ?? 0;
  console.log(`Database connection successful over ${tlsVersion}; ${count} tables found.`);
  console.log(`TLS cipher negotiated: ${tlsCipher}`);
} catch (error) {
  console.error(`Database verification failed: ${redactDatabaseError(error, ENV.databaseUrl)}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
