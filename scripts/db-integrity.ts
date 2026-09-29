import "dotenv/config";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../server/db";

const db = await getDb();
if (!db) throw new Error("DATABASE_URL is required");

const checks = [
  ["credentials without users", sql`SELECT COUNT(*) AS count FROM authCredentials c LEFT JOIN users u ON u.id = c.userId WHERE u.id IS NULL`],
  ["sessions without users", sql`SELECT COUNT(*) AS count FROM authSessions s LEFT JOIN users u ON u.id = s.userId WHERE u.id IS NULL`],
  ["profiles without users", sql`SELECT COUNT(*) AS count FROM learnerProfiles p LEFT JOIN users u ON u.id = p.userId WHERE u.id IS NULL`],
  ["skills without users", sql`SELECT COUNT(*) AS count FROM learnerSkills s LEFT JOIN users u ON u.id = s.userId WHERE u.id IS NULL`],
  ["roadmap rows without users", sql`SELECT COUNT(*) AS count FROM roadmapProgress r LEFT JOIN users u ON u.id = r.userId WHERE u.id IS NULL`],
  ["achievements without users", sql`SELECT COUNT(*) AS count FROM learnerAchievements a LEFT JOIN users u ON u.id = a.userId WHERE u.id IS NULL`],
  ["duplicate credential emails", sql`SELECT COUNT(*) AS count FROM (SELECT emailNormalized FROM authCredentials GROUP BY emailNormalized HAVING COUNT(*) > 1) duplicates`],
] as const;

let failed = false;
try {
  for (const [name, query] of checks) {
    const [rows] = await db.execute(query);
    const count = Number((rows as Array<{ count: number }>)[0]?.count ?? 0);
    console.log(`${name}: ${count}`);
    if (count !== 0) failed = true;
  }
} finally {
  await closeDb();
}
if (failed) {
  console.error("Database integrity verification failed.");
  process.exitCode = 1;
} else {
  console.log("Database integrity verification passed.");
}
