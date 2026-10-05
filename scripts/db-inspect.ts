import "dotenv/config";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { ENV } from "../server/_core/env";
import { redactDatabaseError } from "../server/_core/databaseConfig";
import { closeDb, getDb } from "../server/db";

const uptrailTables = new Set([
  "users",
  "learnerProfiles",
  "learnerSkills",
  "roadmapProgress",
  "learnerAchievements",
  "authCredentials",
  "authSessions",
  "passwordResetTokens",
]);

try {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required");
  const [tableRows] = await db.execute(sql`
    SELECT table_name AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const tables = (tableRows as Array<{ tableName: string }>).map(row => row.tableName);

  console.log(`Current tables (${tables.length}):`);
  let uptrailRowCount = 0;
  for (const table of tables) {
    const [countRows] = await db.execute(
      sql`SELECT COUNT(*) AS rowCount FROM ${sql.identifier(table)}`,
    );
    const rowCount = Number((countRows as Array<{ rowCount: number | string }>)[0]?.rowCount ?? 0);
    console.log(`- ${table}: ${rowCount} rows`);
    if (uptrailTables.has(table)) uptrailRowCount += rowCount;
  }

  if (tables.includes("__drizzle_migrations")) {
    const [migrationRows] = await db.execute(sql`
      SELECT id, created_at AS createdAt
      FROM __drizzle_migrations
      ORDER BY created_at
    `);
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as {
      entries: Array<{ when: number; tag: string }>;
    };
    const tags = new Map(journal.entries.map(entry => [entry.when, entry.tag]));
    console.log(`Drizzle migration records (${(migrationRows as unknown[]).length}):`);
    for (const row of migrationRows as Array<{ id: number; createdAt: number | string }>) {
      const createdAt = Number(row.createdAt);
      console.log(`- id ${row.id}: ${tags.get(createdAt) ?? `unrecognized timestamp ${createdAt}`}`);
    }
  } else {
    console.log("Drizzle migration ledger: absent");
  }

  console.log(`Uptrail application data present: ${uptrailRowCount > 0 ? "yes" : "no"}`);
} catch (error) {
  console.error(`Database inspection failed: ${redactDatabaseError(error, ENV.databaseUrl)}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
