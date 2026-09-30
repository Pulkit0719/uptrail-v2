import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";
import mysql from "mysql2/promise";
import { getDatabaseConnectionOptions, parseDatabaseUrl } from "../server/_core/databaseConfig";
import {
  AUTH_TABLES,
  EXPECTED_LEGACY_COUNTS,
  LEGACY_TABLES,
  V2_LEDGER,
  assertSafeMigrationTarget,
  loadAndValidateV2Migrations,
  sha256,
  validateAppliedPrefix,
  type V2Migration,
} from "./v2-migration-lib";

type LedgerRow = { name: string; hash: string; createdAt: number };
type LegacyEvidence = {
  counts: Map<string, number>;
  fingerprints: Map<string, string>;
  legacyLedger: string;
};

const mode = process.argv.includes("--preflight") ? "preflight"
  : process.argv.includes("--verify") ? "verify"
    : "migrate";
const envFile = process.env.V2_ENV_FILE;
if (!envFile) throw new Error("V2_ENV_FILE is required; no default environment is permitted");
const dotenv = config({ path: resolve(envFile), override: true, quiet: true });
if (dotenv.error) throw new Error("Could not load the explicitly selected V2_ENV_FILE");

const databaseUrl = process.env.DATABASE_URL;
const caFile = process.env.DATABASE_SSL_CA_FILE;
const expectedDatabase = process.env.EXPECTED_DATABASE_NAME ?? "";
if (!databaseUrl || !caFile) throw new Error("Selected environment is missing database TLS configuration");
const parsed = parseDatabaseUrl(databaseUrl);
const loaded = await loadAndValidateV2Migrations();
const allowProtectedDefaultDb = process.env.ALLOW_DEFAULTDB_V2_MIGRATION === "true"
  && process.env.CONFIRM_DEFAULTDB_V2_DATABASE === "defaultdb";

const OLD_FOREIGN_KEYS = new Set([
  "careerAssessmentAttempts.userId->users.id",
  "learnerAchievements.userId->users.id",
  "learnerProfiles.userId->users.id",
  "learnerSkills.userId->users.id",
  "roadmapProgress.userId->users.id",
  "skillAssessmentAttempts.userId->users.id",
]);
const AUTH_FOREIGN_KEYS = new Set([
  "authCredentials.userId->users.id",
  "authSessions.userId->users.id",
  "passwordResetTokens.userId->users.id",
]);

const connection = await mysql.createConnection(getDatabaseConnectionOptions(databaseUrl, caFile));

async function activeDatabase() {
  const [rows] = await connection.query<Array<{ activeDatabase: string } & mysql.RowDataPacket>>(
    "SELECT DATABASE() AS activeDatabase",
  );
  return rows[0]?.activeDatabase ?? "";
}

async function assertLiveTarget() {
  assertSafeMigrationTarget(parsed.database, expectedDatabase, await activeDatabase(), allowProtectedDefaultDb);
}

async function tableNames() {
  const [rows] = await connection.execute<Array<{ tableName: string } & mysql.RowDataPacket>>(
    `SELECT table_name AS tableName FROM information_schema.tables
      WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name`,
    [expectedDatabase],
  );
  return rows.map(row => row.tableName);
}

async function foreignKeys() {
  const [rows] = await connection.execute<Array<{
    tableName: string;
    columnName: string;
    referencedTableName: string;
    referencedColumnName: string;
  } & mysql.RowDataPacket>>(
    `SELECT table_name AS tableName, column_name AS columnName,
            referenced_table_name AS referencedTableName,
            referenced_column_name AS referencedColumnName
       FROM information_schema.key_column_usage
      WHERE table_schema = ? AND referenced_table_name IS NOT NULL
      ORDER BY table_name, column_name`,
    [expectedDatabase],
  );
  return new Set(rows.map(row => `${row.tableName}.${row.columnName}->${row.referencedTableName}.${row.referencedColumnName}`));
}

async function rowCount(table: string) {
  const [rows] = await connection.query<Array<{ rowCount: number | string } & mysql.RowDataPacket>>(
    `SELECT COUNT(*) AS rowCount FROM \`${table}\``,
  );
  return Number(rows[0]?.rowCount ?? -1);
}

async function fingerprint(table: string) {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(`SELECT * FROM \`${table}\` ORDER BY \`id\``);
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

async function verifyLegacyBaseline(allowedTables: Set<string>): Promise<LegacyEvidence> {
  await assertLiveTarget();
  const actualTables = new Set(await tableNames());
  const missing = LEGACY_TABLES.filter(table => !actualTables.has(table));
  const unexpected = [...actualTables].filter(table => !allowedTables.has(table));
  if (missing.length || unexpected.length) throw new Error("Legacy table set does not match the approved baseline");

  const counts = new Map<string, number>();
  const fingerprints = new Map<string, string>();
  for (const [table, expected] of EXPECTED_LEGACY_COUNTS) {
    const actual = await rowCount(table);
    if (actual !== expected) throw new Error(`Legacy row count mismatch for ${table}`);
    counts.set(table, actual);
    fingerprints.set(table, await fingerprint(table));
  }

  const actualForeignKeys = await foreignKeys();
  for (const key of OLD_FOREIGN_KEYS) {
    if (!actualForeignKeys.has(key)) throw new Error(`Missing legacy foreign key: ${key}`);
  }

  for (const key of OLD_FOREIGN_KEYS) {
    const table = key.slice(0, key.indexOf("."));
    const [rows] = await connection.query<Array<{ orphanCount: number | string } & mysql.RowDataPacket>>(
      `SELECT COUNT(*) AS orphanCount FROM \`${table}\` child
        LEFT JOIN \`users\` parent ON parent.id = child.userId WHERE parent.id IS NULL`,
    );
    if (Number(rows[0]?.orphanCount ?? -1) !== 0) throw new Error(`Orphans found in ${table}`);
  }

  const [ledgerRows] = await connection.query<Array<{
    id: number | string;
    hash: string;
    createdAt: number | string;
  } & mysql.RowDataPacket>>(
    "SELECT id, hash, created_at AS createdAt FROM `__drizzle_migrations` ORDER BY id",
  );
  const legacy0000 = await readFile(resolve("drizzle", "0000_flat_daimon_hellstrom.sql"), "utf8");
  const ledgerMatches = ledgerRows.length === 1
    && Number(ledgerRows[0]?.id) === 1
    && ledgerRows[0]?.hash === sha256(legacy0000)
    && Number(ledgerRows[0]?.createdAt) === 1787045175561;
  if (!ledgerMatches) throw new Error("Authentic legacy migration ledger verification failed");

  return { counts, fingerprints, legacyLedger: JSON.stringify(ledgerRows) };
}

async function readV2Ledger(): Promise<LedgerRow[]> {
  const tables = new Set(await tableNames());
  if (!tables.has(V2_LEDGER)) return [];
  const [rows] = await connection.query<Array<{
    name: string;
    hash: string;
    createdAt: number | string;
  } & mysql.RowDataPacket>>(
    `SELECT name, hash, created_at AS createdAt FROM \`${V2_LEDGER}\` ORDER BY id`,
  );
  return rows.map(row => ({ name: row.name, hash: row.hash, createdAt: Number(row.createdAt) }));
}

async function inspectMigrationState(migrations: V2Migration[]) {
  const tables = new Set(await tableNames());
  const hasLedger = tables.has(V2_LEDGER);
  const authPresent = AUTH_TABLES.filter(table => tables.has(table));
  const applied = await readV2Ledger();
  if (hasLedger && applied.length === 0) throw new Error("Partial v2 state: ledger exists without a baseline record");
  if (!hasLedger && authPresent.length > 0) throw new Error("Partial v2 state: auth tables exist without a v2 ledger");
  validateAppliedPrefix(migrations, applied);
  const authMigrationApplied = applied.some(row => row.name === "0001_add_independent_auth");
  if (authMigrationApplied && authPresent.length !== AUTH_TABLES.length) {
    throw new Error("Partial v2 state: auth migration is recorded but its tables are incomplete");
  }
  if (!authMigrationApplied && authPresent.length > 0) {
    throw new Error("Partial v2 state: auth tables exist without their migration record");
  }
  const allowed = new Set<string>(LEGACY_TABLES);
  if (hasLedger) allowed.add(V2_LEDGER);
  if (authMigrationApplied) AUTH_TABLES.forEach(table => allowed.add(table));
  const unexpected = [...tables].filter(table => !allowed.has(table));
  if (unexpected.length) throw new Error("Unexpected tables detected in v2 migration state");
  return { tables, hasLedger, authPresent, applied, authMigrationApplied, allowed };
}

async function verifyAuthSchema() {
  const tables = new Set(await tableNames());
  for (const table of AUTH_TABLES) if (!tables.has(table)) throw new Error(`Missing auth table: ${table}`);

  const expectedColumns = new Map<string, [string, string, string | null, string]>([
    ["authCredentials.id", ["int", "NO", null, "auto_increment"]],
    ["authCredentials.userId", ["int", "NO", null, ""]],
    ["authCredentials.emailNormalized", ["varchar(320)", "NO", null, ""]],
    ["authCredentials.passwordHash", ["varchar(128)", "NO", null, ""]],
    ["authCredentials.passwordSalt", ["varchar(64)", "NO", null, ""]],
    ["authCredentials.createdAt", ["timestamp", "NO", "CURRENT_TIMESTAMP", "DEFAULT_GENERATED"]],
    ["authCredentials.updatedAt", ["timestamp", "NO", "CURRENT_TIMESTAMP", "DEFAULT_GENERATED on update CURRENT_TIMESTAMP"]],
    ["authSessions.id", ["char(36)", "NO", null, ""]],
    ["authSessions.userId", ["int", "NO", null, ""]],
    ["authSessions.tokenHash", ["char(64)", "NO", null, ""]],
    ["authSessions.csrfHash", ["char(64)", "NO", null, ""]],
    ["authSessions.expiresAt", ["timestamp", "NO", null, ""]],
    ["authSessions.revokedAt", ["timestamp", "YES", null, ""]],
    ["authSessions.lastSeenAt", ["timestamp", "NO", "CURRENT_TIMESTAMP", "DEFAULT_GENERATED"]],
    ["authSessions.createdAt", ["timestamp", "NO", "CURRENT_TIMESTAMP", "DEFAULT_GENERATED"]],
    ["passwordResetTokens.id", ["char(36)", "NO", null, ""]],
    ["passwordResetTokens.userId", ["int", "NO", null, ""]],
    ["passwordResetTokens.tokenHash", ["char(64)", "NO", null, ""]],
    ["passwordResetTokens.expiresAt", ["timestamp", "NO", null, ""]],
    ["passwordResetTokens.usedAt", ["timestamp", "YES", null, ""]],
    ["passwordResetTokens.createdAt", ["timestamp", "NO", "CURRENT_TIMESTAMP", "DEFAULT_GENERATED"]],
  ]);
  const [columnRows] = await connection.execute<Array<{
    tableName: string;
    columnName: string;
    columnType: string;
    isNullable: string;
    columnDefault: string | null;
    extraValue: string;
  } & mysql.RowDataPacket>>(
    `SELECT table_name AS tableName, column_name AS columnName, column_type AS columnType,
            is_nullable AS isNullable, column_default AS columnDefault, extra AS extraValue
       FROM information_schema.columns
      WHERE table_schema = ? AND table_name IN (?, ?, ?) ORDER BY table_name, ordinal_position`,
    [expectedDatabase, ...AUTH_TABLES],
  );
  if (columnRows.length !== expectedColumns.size) throw new Error("Auth column count mismatch");
  for (const row of columnRows) {
    const expected = expectedColumns.get(`${row.tableName}.${row.columnName}`);
    if (!expected
      || row.columnType !== expected[0]
      || row.isNullable !== expected[1]
      || row.columnDefault !== expected[2]
      || row.extraValue !== expected[3]) {
      throw new Error(`Auth column definition mismatch: ${row.tableName}.${row.columnName}`);
    }
  }

  const [collationRows] = await connection.execute<Array<{ tableName: string; tableCollation: string } & mysql.RowDataPacket>>(
    `SELECT table_name AS tableName, table_collation AS tableCollation
       FROM information_schema.tables WHERE table_schema = ? AND table_name IN (?, ?, ?)`,
    [expectedDatabase, ...AUTH_TABLES],
  );
  if (collationRows.length !== 3 || collationRows.some(row => row.tableCollation !== "utf8mb4_unicode_ci")) {
    throw new Error("Auth table collation mismatch");
  }

  const expectedIndexes = new Set([
    "authCredentials.PRIMARY:0:id",
    "authCredentials.authCredentials_emailNormalized_unique:0:emailNormalized",
    "authCredentials.authCredentials_userId_unique:0:userId",
    "authSessions.PRIMARY:0:id",
    "authSessions.authSessions_expiry_idx:1:expiresAt",
    "authSessions.authSessions_tokenHash_unique:0:tokenHash",
    "authSessions.authSessions_user_idx:1:userId",
    "passwordResetTokens.PRIMARY:0:id",
    "passwordResetTokens.passwordResetTokens_expiry_idx:1:expiresAt",
    "passwordResetTokens.passwordResetTokens_tokenHash_unique:0:tokenHash",
    "passwordResetTokens.passwordResetTokens_user_idx:1:userId",
  ]);
  const [indexRows] = await connection.execute<Array<{
    tableName: string;
    indexName: string;
    nonUnique: number;
    columnName: string;
  } & mysql.RowDataPacket>>(
    `SELECT table_name AS tableName, index_name AS indexName, non_unique AS nonUnique,
            column_name AS columnName FROM information_schema.statistics
      WHERE table_schema = ? AND table_name IN (?, ?, ?) ORDER BY table_name, index_name, seq_in_index`,
    [expectedDatabase, ...AUTH_TABLES],
  );
  const actualIndexes = new Set(indexRows.map(row => `${row.tableName}.${row.indexName}:${row.nonUnique}:${row.columnName}`));
  for (const index of expectedIndexes) if (!actualIndexes.has(index)) throw new Error(`Missing auth index: ${index}`);

  const actualForeignKeys = await foreignKeys();
  for (const key of AUTH_FOREIGN_KEYS) if (!actualForeignKeys.has(key)) throw new Error(`Missing auth foreign key: ${key}`);

  const [ruleRows] = await connection.execute<Array<{
    constraintName: string;
    updateRule: string;
    deleteRule: string;
  } & mysql.RowDataPacket>>(
    `SELECT constraint_name AS constraintName, update_rule AS updateRule, delete_rule AS deleteRule
       FROM information_schema.referential_constraints
      WHERE constraint_schema = ? AND table_name IN (?, ?, ?)`,
    [expectedDatabase, ...AUTH_TABLES],
  );
  if (ruleRows.length !== 3 || ruleRows.some(row => row.updateRule !== "NO ACTION" || row.deleteRule !== "CASCADE")) {
    throw new Error("Auth foreign-key action mismatch");
  }

  for (const table of AUTH_TABLES) {
    if (await rowCount(table) !== 0) throw new Error(`Auth table is not empty after schema migration: ${table}`);
  }
}

async function createLedger() {
  await assertLiveTarget();
  await connection.query(`CREATE TABLE \`${V2_LEDGER}\` (
    \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
    \`name\` varchar(191) NOT NULL,
    \`hash\` char(64) NOT NULL,
    \`created_at\` bigint NOT NULL,
    \`applied_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT \`${V2_LEDGER}_id\` PRIMARY KEY (\`id\`),
    CONSTRAINT \`${V2_LEDGER}_name_unique\` UNIQUE (\`name\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function recordMigration(migration: V2Migration) {
  await assertLiveTarget();
  await connection.execute(
    `INSERT INTO \`${V2_LEDGER}\` (name, hash, created_at) VALUES (?, ?, ?)`,
    [migration.name, migration.sha256, migration.timestamp],
  );
}

async function verifyTls() {
  const [rows] = await connection.query<Array<{ Variable_name: string; Value: string } & mysql.RowDataPacket>>(
    "SHOW SESSION STATUS WHERE Variable_name IN ('Ssl_cipher', 'Ssl_version')",
  );
  const tls = new Map(rows.map(row => [row.Variable_name, row.Value]));
  if (!tls.get("Ssl_version") || !tls.get("Ssl_cipher")) throw new Error("TLS was not negotiated");
  return `${tls.get("Ssl_version")} / ${tls.get("Ssl_cipher")}`;
}

try {
  await assertLiveTarget();
  const tls = await verifyTls();
  const state = await inspectMigrationState(loaded.migrations);
  const legacyBefore = await verifyLegacyBaseline(state.allowed);

  console.log(`Active database: ${expectedDatabase}`);
  console.log(`TLS: ${tls}`);
  for (const [table, count] of legacyBefore.counts) console.log(`Rows ${table}: ${count}`);
  console.log(`Legacy foreign keys: ${OLD_FOREIGN_KEYS.size}; orphans: 0`);
  console.log(`Legacy ledger: authentic 0000 only`);
  for (const migration of loaded.migrations) console.log(`Migration ${migration.name} SHA-256: ${migration.sha256}`);
  console.log("SQL safety: NO DROP; NO DELETE; NO TRUNCATE; NO existing-user UPDATE; NO learner-data mutation; NO legacy-assessment mutation");

  if (mode === "preflight") {
    if (state.hasLedger || state.authPresent.length > 0 || state.tables.size !== LEGACY_TABLES.length) {
      throw new Error("Preflight requires the untouched eight-table imported baseline");
    }
    console.log("V2 migration preflight: PASS");
  } else if (mode === "verify") {
    if (state.applied.length !== loaded.migrations.length) throw new Error("Not all v2 migrations are applied");
    await verifyAuthSchema();
    const finalTables = await tableNames();
    if (finalTables.length !== 12) throw new Error("Post-migration table count is not 12");
    const allForeignKeys = await foreignKeys();
    if (allForeignKeys.size !== 9) throw new Error("Post-migration foreign-key count is not 9");
    console.log(`V2 ledger records: ${state.applied.length}`);
    console.log("V2 post-migration verification: PASS");
  } else {
    if (process.env.ALLOW_V2_MIGRATION !== "true") throw new Error("ALLOW_V2_MIGRATION=true is required");
    const backupFile = process.env.V2_PREMIGRATION_BACKUP_FILE;
    const backupHash = process.env.V2_PREMIGRATION_BACKUP_SHA256;
    if (!backupFile || !backupHash) throw new Error("Verified pre-migration backup evidence is required");
    if (sha256(await readFile(resolve(backupFile))) !== backupHash.toLowerCase()) {
      throw new Error("Pre-migration backup checksum does not match");
    }

    const alreadyComplete = state.applied.length === loaded.migrations.length;
    if (!state.hasLedger) await createLedger();
    let applied = await readV2Ledger();
    for (let index = applied.length; index < loaded.migrations.length; index += 1) {
      const migration = loaded.migrations[index]!;
      if (migration.kind === "baseline") {
        await recordMigration(migration);
      } else {
        const currentTables = new Set(await tableNames());
        if (AUTH_TABLES.some(table => currentTables.has(table))) {
          throw new Error("Partial migration detected before auth DDL execution");
        }
        for (const statement of migration.statements) {
          await assertLiveTarget();
          await connection.query(statement);
        }
        await verifyAuthSchema();
        await recordMigration(migration);
      }
      applied = await readV2Ledger();
      validateAppliedPrefix(loaded.migrations, applied);
    }

    const finalState = await inspectMigrationState(loaded.migrations);
    if (finalState.applied.length !== loaded.migrations.length) throw new Error("V2 migration sequence is incomplete");
    await verifyAuthSchema();
    const legacyAfter = await verifyLegacyBaseline(finalState.allowed);
    for (const [table, before] of legacyBefore.fingerprints) {
      if (legacyAfter.fingerprints.get(table) !== before) throw new Error(`Legacy row fingerprint changed for ${table}`);
    }
    if (legacyAfter.legacyLedger !== legacyBefore.legacyLedger) throw new Error("Legacy migration ledger changed");
    if ((await tableNames()).length !== 12) throw new Error("Final table count is not 12");
    if ((await foreignKeys()).size !== 9) throw new Error("Final foreign-key count is not 9");
    if (alreadyComplete) console.log("Already-applied migration set detected; no migration write was executed.");
    console.log(`Applied migrations: ${finalState.applied.map(row => row.name).join(", ")}`);
    console.log("Legacy row fingerprints: unchanged");
    console.log("Guarded v2 migration: PASS");
  }
} catch (error) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "guard_failure";
  console.error(`Guarded v2 migration failed (${code}); connection details were suppressed.`);
  if (error instanceof Error) {
    let safeMessage = error.message.replaceAll(databaseUrl, "[REDACTED_DATABASE_URL]");
    for (const value of [parsed.password, parsed.user, parsed.host]) {
      if (value) safeMessage = safeMessage.replaceAll(value, "[REDACTED]");
    }
    console.error(safeMessage);
  }
  process.exitCode = 1;
} finally {
  await connection.end();
}
