import "dotenv/config";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../server/db";

const db = await getDb();
if (!db) throw new Error("DATABASE_URL is required");

try {
  const [rows] = await db.execute(sql`
    SELECT COUNT(*) AS userCount,
           SUM(CASE WHEN openId IS NULL OR openId = '' THEN 1 ELSE 0 END) AS missingOpenIdCount,
           COUNT(DISTINCT openId) AS distinctOpenIdCount,
           SUM(CASE WHEN loginMethod = 'password' THEN 1 ELSE 0 END) AS passwordLoginCount
    FROM users
  `);
  const result = (rows as Array<{
    userCount: number | string;
    missingOpenIdCount: number | string;
    distinctOpenIdCount: number | string;
    passwordLoginCount: number | string;
  }>)[0];
  console.log(`Legacy users: ${Number(result?.userCount ?? 0)}`);
  console.log(`Missing external subjects: ${Number(result?.missingOpenIdCount ?? 0)}`);
  console.log(`Distinct external subjects: ${Number(result?.distinctOpenIdCount ?? 0)}`);
  console.log(`Users already marked for password login: ${Number(result?.passwordLoginCount ?? 0)}`);
} finally {
  await closeDb();
}
