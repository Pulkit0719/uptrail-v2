import "dotenv/config";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../server/db";

const db = await getDb();
if (!db) throw new Error("DATABASE_URL is required");
try {
  await db.execute(sql`SELECT 1`);
  const [tables] = await db.execute(sql`
    SELECT COUNT(*) AS tableCount
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `);
  const count = (tables as Array<{ tableCount: number }>)[0]?.tableCount ?? 0;
  console.log(`Database connection successful; ${count} application tables found.`);
} finally {
  await closeDb();
}
