import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { ENV } from "../server/_core/env";
import { redactDatabaseError } from "../server/_core/databaseConfig";
import { closeDb, getDb } from "../server/db";

const expectedRows = new Map<string, number>([
  ["__drizzle_migrations", 1],
  ["careerAssessmentAttempts", 1],
  ["learnerAchievements", 0],
  ["learnerProfiles", 1],
  ["learnerSkills", 2],
  ["roadmapProgress", 2],
  ["skillAssessmentAttempts", 1],
  ["users", 1],
]);

const expectedForeignKeys = new Set([
  "careerAssessmentAttempts.userId->users.id",
  "learnerAchievements.userId->users.id",
  "learnerProfiles.userId->users.id",
  "learnerSkills.userId->users.id",
  "roadmapProgress.userId->users.id",
  "skillAssessmentAttempts.userId->users.id",
]);

let failed = false;
try {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required");

  const [databaseRows] = await db.execute(sql`SELECT DATABASE() AS activeDatabase`);
  const activeDatabase = (databaseRows as Array<{ activeDatabase: string }>)[0]?.activeDatabase;
  const expectedDatabase = process.env.EXPECTED_DATABASE_NAME;
  if (expectedDatabase && activeDatabase !== expectedDatabase) {
    throw new Error(`Active database does not match EXPECTED_DATABASE_NAME`);
  }
  console.log(`Active database: ${activeDatabase}`);

  const [tlsRows] = await db.execute(sql`SHOW SESSION STATUS WHERE Variable_name IN ('Ssl_cipher', 'Ssl_version')`);
  const tls = new Map((tlsRows as Array<{ Variable_name: string; Value: string }>).map(row => [row.Variable_name, row.Value]));
  const tlsVersion = tls.get("Ssl_version") ?? "";
  const tlsCipher = tls.get("Ssl_cipher") ?? "";
  if (!tlsVersion || !tlsCipher) failed = true;
  console.log(`TLS: ${tlsVersion || "missing"} / ${tlsCipher || "missing"}`);

  const [tableRows] = await db.execute(sql`
    SELECT table_name AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const actualTables = new Set((tableRows as Array<{ tableName: string }>).map(row => row.tableName));
  const missingTables = [...expectedRows.keys()].filter(table => !actualTables.has(table));
  const unexpectedTables = [...actualTables].filter(table => !expectedRows.has(table));
  if (missingTables.length || unexpectedTables.length) failed = true;
  console.log(`Tables: ${actualTables.size}; missing: ${missingTables.join(", ") || "none"}; unexpected: ${unexpectedTables.join(", ") || "none"}`);

  for (const [table, expected] of expectedRows) {
    if (!actualTables.has(table)) continue;
    const [rows] = await db.execute(sql`SELECT COUNT(*) AS rowCount FROM ${sql.identifier(table)}`);
    const actual = Number((rows as Array<{ rowCount: number | string }>)[0]?.rowCount ?? -1);
    if (actual !== expected) failed = true;
    console.log(`Rows ${table}: ${actual} (expected ${expected})`);
  }

  const [foreignKeyRows] = await db.execute(sql`
    SELECT table_name AS tableName, column_name AS columnName,
           referenced_table_name AS referencedTableName,
           referenced_column_name AS referencedColumnName
    FROM information_schema.key_column_usage
    WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL
    ORDER BY table_name, column_name
  `);
  const actualForeignKeys = new Set(
    (foreignKeyRows as Array<{
      tableName: string;
      columnName: string;
      referencedTableName: string;
      referencedColumnName: string;
    }>).map(row => `${row.tableName}.${row.columnName}->${row.referencedTableName}.${row.referencedColumnName}`),
  );
  const missingForeignKeys = [...expectedForeignKeys].filter(key => !actualForeignKeys.has(key));
  const unexpectedForeignKeys = [...actualForeignKeys].filter(key => !expectedForeignKeys.has(key));
  if (missingForeignKeys.length || unexpectedForeignKeys.length) failed = true;
  console.log(`Foreign keys: ${actualForeignKeys.size}; missing: ${missingForeignKeys.join(", ") || "none"}; unexpected: ${unexpectedForeignKeys.join(", ") || "none"}`);

  for (const table of [...expectedForeignKeys].map(key => key.split(".")[0])) {
    const [rows] = await db.execute(sql`
      SELECT COUNT(*) AS orphanCount
      FROM ${sql.identifier(table)} child
      LEFT JOIN users parent ON parent.id = child.userId
      WHERE parent.id IS NULL
    `);
    const orphanCount = Number((rows as Array<{ orphanCount: number | string }>)[0]?.orphanCount ?? -1);
    if (orphanCount !== 0) failed = true;
    console.log(`Orphans ${table}->users: ${orphanCount}`);
  }

  const [ledgerRows] = await db.execute(sql`SELECT id, hash, created_at AS createdAt FROM __drizzle_migrations ORDER BY id`);
  const ledger = ledgerRows as Array<{ id: number | string; hash: string; createdAt: number | string }>;
  const migration = await readFile("drizzle/0000_flat_daimon_hellstrom.sql", "utf8");
  const expectedHash = createHash("sha256").update(migration).digest("hex");
  const ledgerMatches = ledger.length === 1
    && Number(ledger[0].id) === 1
    && ledger[0].hash === expectedHash
    && Number(ledger[0].createdAt) === 1787045175561;
  if (!ledgerMatches) failed = true;
  console.log(`Drizzle ledger: ${ledgerMatches ? "matches 0000" : "mismatch"}`);

  console.log(`Restored database verification: ${failed ? "FAIL" : "PASS"}`);
} catch (error) {
  failed = true;
  console.error(`Restored database verification failed: ${redactDatabaseError(error, ENV.databaseUrl)}`);
} finally {
  await closeDb();
}

if (failed) process.exitCode = 1;
