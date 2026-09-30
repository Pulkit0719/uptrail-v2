import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type V2Migration = {
  name: string;
  file: string;
  timestamp: number;
  kind: "baseline" | "sql";
  sha256: string;
};

export type V2Manifest = {
  version: number;
  ledgerTable: "__uptrail_v2_migrations";
  source: string;
  migrations: V2Migration[];
};

export const V2_LEDGER = "__uptrail_v2_migrations";
export const LEGACY_TABLES = [
  "__drizzle_migrations",
  "careerAssessmentAttempts",
  "learnerAchievements",
  "learnerProfiles",
  "learnerSkills",
  "roadmapProgress",
  "skillAssessmentAttempts",
  "users",
] as const;
export const AUTH_TABLES = ["authCredentials", "authSessions", "passwordResetTokens"] as const;

export const EXPECTED_LEGACY_COUNTS = new Map<string, number>([
  ["__drizzle_migrations", 1],
  ["careerAssessmentAttempts", 1],
  ["learnerAchievements", 0],
  ["learnerProfiles", 1],
  ["learnerSkills", 2],
  ["roadmapProgress", 2],
  ["skillAssessmentAttempts", 1],
  ["users", 1],
]);

export function sha256(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

export function assertSafeMigrationTarget(
  parsedDatabase: string,
  expectedDatabase: string,
  activeDatabase: string,
  allowProtectedDefaultDb = false,
) {
  if (!expectedDatabase) throw new Error("EXPECTED_DATABASE_NAME is required");
  if (expectedDatabase.toLowerCase() === "defaultdb" && !allowProtectedDefaultDb) {
    throw new Error("defaultdb is a protected migration target");
  }
  if (parsedDatabase !== expectedDatabase) throw new Error("Parsed database does not match EXPECTED_DATABASE_NAME");
  if (activeDatabase !== expectedDatabase) throw new Error("Live database does not match EXPECTED_DATABASE_NAME");
}

export function splitMigrationSql(source: string): string[] {
  return source
    .split(/\s*-->\s*statement-breakpoint\s*/)
    .map(part => part.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

export function validateMigrationSql(source: string): string[] {
  const statements = splitMigrationSql(source);
  if (statements.length === 0) throw new Error("SQL migration contains no statements");
  for (const statement of statements) {
    if (!/^CREATE\s+TABLE\s+/i.test(statement)) {
      throw new Error("V2 SQL migration contains a statement other than CREATE TABLE");
    }
    if (/\bDROP\b/i.test(statement)
      || /\bTRUNCATE\b/i.test(statement)
      || /\bDELETE\s+FROM\b/i.test(statement)
      || /(?:^|;)\s*UPDATE\s+[`\w]/i.test(statement)
      || /\bINSERT\s+INTO\b/i.test(statement)
      || /\bREPLACE\s+INTO\b/i.test(statement)
      || /\bALTER\s+TABLE\b/i.test(statement)) {
      throw new Error("V2 SQL migration contains forbidden mutation SQL");
    }
  }
  return statements;
}

export async function loadAndValidateV2Migrations(directory = resolve("drizzle-v2")) {
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as V2Manifest;
  if (manifest.version !== 1 || manifest.ledgerTable !== V2_LEDGER || manifest.migrations.length === 0) {
    throw new Error("Invalid v2 migration manifest");
  }
  if (new Set(manifest.migrations.map(migration => migration.name)).size !== manifest.migrations.length) {
    throw new Error("Duplicate v2 migration name");
  }
  if (manifest.migrations[0]?.kind !== "baseline") throw new Error("First v2 migration must be the imported baseline");

  const loaded = [] as Array<V2Migration & { source: string; statements: string[] }>;
  for (const migration of manifest.migrations) {
    if (!/^[a-zA-Z0-9_-]+\.sql$/.test(migration.file)) throw new Error("Unsafe v2 migration filename");
    const source = await readFile(resolve(directory, migration.file), "utf8");
    if (sha256(source.replaceAll("\r\n", "\n")) !== migration.sha256) throw new Error(`Hash mismatch for ${migration.name}`);
    const statements = migration.kind === "baseline" ? [] : validateMigrationSql(source);
    if (migration.kind === "baseline" && !/verification-only baseline/i.test(source)) {
      throw new Error("Baseline migration is not explicitly verification-only");
    }
    loaded.push({ ...migration, source, statements });
  }
  return { manifest, migrations: loaded };
}

export function validateAppliedPrefix(
  migrations: V2Migration[],
  applied: Array<{ name: string; hash: string; createdAt: number }>,
) {
  if (applied.length > migrations.length) throw new Error("V2 ledger contains unexpected migrations");
  for (let index = 0; index < applied.length; index += 1) {
    const actual = applied[index];
    const expected = migrations[index];
    if (!actual || !expected
      || actual.name !== expected.name
      || actual.hash !== expected.sha256
      || actual.createdAt !== expected.timestamp) {
      throw new Error("V2 ledger is not a valid applied migration prefix");
    }
  }
}
