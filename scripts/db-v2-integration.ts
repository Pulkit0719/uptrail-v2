import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config } from "dotenv";
import mysql from "mysql2/promise";
import { getDatabaseConnectionOptions, parseDatabaseUrl } from "../server/_core/databaseConfig";
import { assertSafeMigrationTarget, EXPECTED_LEGACY_COUNTS } from "./v2-migration-lib";

const DRYRUN_DATABASE = "uptrail_migration_dryrun";
const envFile = process.env.V2_ENV_FILE;
if (!envFile) throw new Error("V2_ENV_FILE is required");
const dotenv = config({ path: resolve(envFile), override: true, quiet: true });
if (dotenv.error) throw new Error("Could not load V2_ENV_FILE");
const databaseUrl = process.env.DATABASE_URL;
const caFile = process.env.DATABASE_SSL_CA_FILE;
if (!databaseUrl || !caFile) throw new Error("Dry-run database TLS configuration is incomplete");
const parsed = parseDatabaseUrl(databaseUrl);
const expectedDatabase = process.env.EXPECTED_DATABASE_NAME ?? "";
if (expectedDatabase !== DRYRUN_DATABASE) throw new Error("Integration tests require the named dry-run database");

const connection = await mysql.createConnection(getDatabaseConnectionOptions(databaseUrl, caFile));
const testSuffix = randomUUID();
const testOpenId = `dryrun_test_${testSuffix}`;
const testEmail = `dryrun-${testSuffix}@example.invalid`;
let testUserId: number | undefined;

async function assertLiveTarget() {
  const [rows] = await connection.query<Array<{ activeDatabase: string } & mysql.RowDataPacket>>(
    "SELECT DATABASE() AS activeDatabase",
  );
  assertSafeMigrationTarget(parsed.database, expectedDatabase, rows[0]?.activeDatabase ?? "");
}

async function guardedWrite(sql: string, values: unknown[] = []) {
  await assertLiveTarget();
  return connection.execute(sql, values);
}

async function count(table: string) {
  const [rows] = await connection.query<Array<{ rowCount: number | string } & mysql.RowDataPacket>>(
    `SELECT COUNT(*) AS rowCount FROM \`${table}\``,
  );
  return Number(rows[0]?.rowCount ?? -1);
}

try {
  await assertLiveTarget();
  const { hashPassword, isSessionRecordActive, verifyPassword } = await import("../server/_core/auth");

  for (const [table, expected] of EXPECTED_LEGACY_COUNTS) {
    if (await count(table) !== expected) throw new Error(`Legacy read mismatch for ${table}`);
  }

  const password = `DryRun-${randomUUID()}-password`;
  const replacementPassword = `DryRun-${randomUUID()}-replacement`;
  const stored = await hashPassword(password);
  const [userInsert] = await guardedWrite(
    `INSERT INTO users (openId, name, email, loginMethod, role)
     VALUES (?, 'Uptrail Dry-Run Test', ?, 'password', 'user')`,
    [testOpenId, testEmail],
  );
  testUserId = Number((userInsert as mysql.ResultSetHeader).insertId);
  if (!testUserId) throw new Error("Disposable user insert failed");

  await guardedWrite(
    `INSERT INTO authCredentials (userId, emailNormalized, passwordHash, passwordSalt)
     VALUES (?, ?, ?, ?)`,
    [testUserId, testEmail, stored.hash, stored.salt],
  );
  const [credentials] = await connection.execute<Array<{
    passwordHash: string;
    passwordSalt: string;
  } & mysql.RowDataPacket>>(
    "SELECT passwordHash, passwordSalt FROM authCredentials WHERE userId = ?",
    [testUserId],
  );
  const credential = credentials[0];
  if (!credential
    || !(await verifyPassword(password, credential.passwordHash, credential.passwordSalt))
    || await verifyPassword("definitely-invalid", credential.passwordHash, credential.passwordSalt)) {
    throw new Error("Credential verification behavior failed");
  }

  const activeSessionId = randomUUID();
  const expiredSessionId = randomUUID();
  const now = new Date();
  await guardedWrite(
    `INSERT INTO authSessions (id, userId, tokenHash, csrfHash, expiresAt)
     VALUES (?, ?, ?, ?, ?)`,
    [activeSessionId, testUserId, createHash("sha256").update(randomUUID()).digest("hex"), createHash("sha256").update(randomUUID()).digest("hex"), new Date(now.getTime() + 60_000)],
  );
  await guardedWrite(
    `INSERT INTO authSessions (id, userId, tokenHash, csrfHash, expiresAt)
     VALUES (?, ?, ?, ?, ?)`,
    [expiredSessionId, testUserId, createHash("sha256").update(randomUUID()).digest("hex"), createHash("sha256").update(randomUUID()).digest("hex"), new Date(now.getTime() - 60_000)],
  );
  const [sessionRows] = await connection.execute<Array<{
    id: string;
    expiresAt: Date;
    revokedAt: Date | null;
  } & mysql.RowDataPacket>>(
    "SELECT id, expiresAt, revokedAt FROM authSessions WHERE userId = ? ORDER BY id",
    [testUserId],
  );
  const active = sessionRows.find(row => row.id === activeSessionId);
  const expired = sessionRows.find(row => row.id === expiredSessionId);
  if (!active || !expired || !isSessionRecordActive(active, now) || isSessionRecordActive(expired, now)) {
    throw new Error("Session expiration behavior failed");
  }
  await guardedWrite("UPDATE authSessions SET revokedAt = CURRENT_TIMESTAMP WHERE id = ?", [activeSessionId]);
  const [revokedRows] = await connection.execute<Array<{ revokedAt: Date | null } & mysql.RowDataPacket>>(
    "SELECT revokedAt FROM authSessions WHERE id = ?",
    [activeSessionId],
  );
  if (!revokedRows[0]?.revokedAt) throw new Error("Session revocation behavior failed");

  const resetId = randomUUID();
  const resetHash = createHash("sha256").update(randomUUID()).digest("hex");
  await guardedWrite(
    `INSERT INTO passwordResetTokens (id, userId, tokenHash, expiresAt)
     VALUES (?, ?, ?, ?)`,
    [resetId, testUserId, resetHash, new Date(now.getTime() + 60_000)],
  );
  const next = await hashPassword(replacementPassword);
  await guardedWrite("UPDATE passwordResetTokens SET usedAt = CURRENT_TIMESTAMP WHERE id = ? AND usedAt IS NULL", [resetId]);
  await guardedWrite(
    "UPDATE authCredentials SET passwordHash = ?, passwordSalt = ? WHERE userId = ?",
    [next.hash, next.salt, testUserId],
  );
  const [resetRows] = await connection.execute<Array<{ usedAt: Date | null } & mysql.RowDataPacket>>(
    "SELECT usedAt FROM passwordResetTokens WHERE id = ?",
    [resetId],
  );
  const [nextCredentials] = await connection.execute<Array<{
    passwordHash: string;
    passwordSalt: string;
  } & mysql.RowDataPacket>>(
    "SELECT passwordHash, passwordSalt FROM authCredentials WHERE userId = ?",
    [testUserId],
  );
  const nextCredential = nextCredentials[0];
  if (!resetRows[0]?.usedAt || !nextCredential
    || !(await verifyPassword(replacementPassword, nextCredential.passwordHash, nextCredential.passwordSalt))
    || await verifyPassword(password, nextCredential.passwordHash, nextCredential.passwordSalt)) {
    throw new Error("Password-reset behavior failed");
  }

  console.log("Legacy application reads: PASS");
  console.log("Credential creation and password hashing: PASS");
  console.log("Valid/invalid password behavior: PASS");
  console.log("Session creation, expiration, and revocation: PASS");
  console.log("Password reset token and replacement password behavior: PASS");
} catch (error) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "integration_failure";
  console.error(`Dry-run auth integration failed (${code}); secret details were suppressed.`);
  process.exitCode = 1;
} finally {
  try {
    if (testUserId) await guardedWrite("DELETE FROM users WHERE id = ? AND openId = ?", [testUserId, testOpenId]);
    for (const [table, expected] of EXPECTED_LEGACY_COUNTS) {
      if (await count(table) !== expected) throw new Error(`Cleanup count mismatch for ${table}`);
    }
    for (const table of ["authCredentials", "authSessions", "passwordResetTokens"]) {
      if (await count(table) !== 0) throw new Error(`Disposable auth data remains in ${table}`);
    }
    console.log("Disposable dry-run records cleaned: PASS");
  } catch {
    console.error("Dry-run integration cleanup verification failed; secret details were suppressed.");
    process.exitCode = 1;
  }
  await connection.end();
}
