import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";
import mysql from "mysql2/promise";
import { z } from "zod";
import { getDatabaseConnectionOptions, parseDatabaseUrl } from "../server/_core/databaseConfig";

type LinkEvidence = {
  userId: number;
  openId: string;
  dataFingerprints: Map<string, string>;
  legacyLedger: string;
  v2Ledger: string;
};

const mode = process.argv.includes("--preflight") ? "preflight"
  : process.argv.includes("--link") ? "link"
    : "invalid";
if (mode === "invalid") throw new Error("Select --preflight or --link explicitly");

config({ path: resolve(".env"), override: false, quiet: true });
const accountLinkEnv = process.env.ACCOUNT_LINK_ENV_FILE ?? ".env.account-link";
const linkConfig = config({ path: resolve(accountLinkEnv), override: true, quiet: true });
if (linkConfig.error) throw new Error("Could not load the ignored account-link environment file");

const databaseUrl = process.env.DATABASE_URL;
const caFile = process.env.DATABASE_SSL_CA_FILE;
const expectedDatabase = process.env.EXPECTED_DATABASE_NAME;
const openId = process.env.LEGACY_USER_OPEN_ID?.trim();
const email = process.env.LOCAL_AUTH_EMAIL?.trim();
const password = process.env.LOCAL_AUTH_PASSWORD;
if (!databaseUrl || !caFile) throw new Error("Database TLS configuration is incomplete");
if (expectedDatabase !== "defaultdb") throw new Error("Account linking requires EXPECTED_DATABASE_NAME=defaultdb");
if (!openId || !email || !password) {
  throw new Error("The ignored account-link environment file is incomplete");
}
if (!z.string().trim().email().max(320).safeParse(email).success) {
  throw new Error("LOCAL_AUTH_EMAIL is not a valid email address");
}
if (password.length < 12 || password.length > 128) {
  throw new Error("LOCAL_AUTH_PASSWORD must be 12-128 characters");
}

const parsed = parseDatabaseUrl(databaseUrl);
if (parsed.database !== expectedDatabase) throw new Error("Parsed database target mismatch");
const connection = await mysql.createConnection(getDatabaseConnectionOptions(databaseUrl, caFile));
const DATA_TABLES = [
  "learnerProfiles",
  "learnerSkills",
  "roadmapProgress",
  "learnerAchievements",
  "careerAssessmentAttempts",
  "skillAssessmentAttempts",
] as const;
const EXPECTED_DATA_COUNTS = new Map<string, number>([
  ["learnerProfiles", 1],
  ["learnerSkills", 2],
  ["roadmapProgress", 2],
  ["learnerAchievements", 0],
  ["careerAssessmentAttempts", 1],
  ["skillAssessmentAttempts", 1],
]);

async function assertLiveTarget(executor: mysql.Connection | mysql.PoolConnection = connection) {
  const [rows] = await executor.query<Array<{ activeDatabase: string } & mysql.RowDataPacket>>(
    "SELECT DATABASE() AS activeDatabase",
  );
  if (rows[0]?.activeDatabase !== "defaultdb") throw new Error("Live database target mismatch");
}

async function count(table: string, userId?: number) {
  const statement = userId === undefined
    ? `SELECT COUNT(*) AS rowCount FROM \`${table}\``
    : `SELECT COUNT(*) AS rowCount FROM \`${table}\` WHERE userId = ?`;
  const [rows] = await connection.query<Array<{ rowCount: number | string } & mysql.RowDataPacket>>(
    statement,
    userId === undefined ? [] : [userId],
  );
  return Number(rows[0]?.rowCount ?? -1);
}

async function fingerprint(table: string) {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(`SELECT * FROM \`${table}\` ORDER BY id`);
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

async function collectEvidence(): Promise<LinkEvidence> {
  await assertLiveTarget();
  const [users] = await connection.execute<Array<{ id: number; openId: string } & mysql.RowDataPacket>>(
    "SELECT id, openId FROM users WHERE BINARY openId = BINARY ? ORDER BY id LIMIT 2",
    [openId],
  );
  if (users.length !== 1) throw new Error("Legacy identity did not resolve to exactly one user");
  const user = users[0]!;
  if (await count("users") !== 1) throw new Error("Unexpected total user count");

  const [credentialRows] = await connection.execute<Array<{ rowCount: number | string } & mysql.RowDataPacket>>(
    "SELECT COUNT(*) AS rowCount FROM authCredentials WHERE userId = ?",
    [user.id],
  );
  if (Number(credentialRows[0]?.rowCount ?? -1) !== 0) {
    throw new Error("The legacy user already has a local credential");
  }
  const { normalizeEmail } = await import("../server/_core/auth");
  const [emailRows] = await connection.execute<Array<{ rowCount: number | string } & mysql.RowDataPacket>>(
    "SELECT COUNT(*) AS rowCount FROM authCredentials WHERE emailNormalized = ?",
    [normalizeEmail(email)],
  );
  if (Number(emailRows[0]?.rowCount ?? -1) !== 0) {
    throw new Error("The local-auth email is already assigned");
  }

  const dataFingerprints = new Map<string, string>();
  for (const table of DATA_TABLES) {
    const expected = EXPECTED_DATA_COUNTS.get(table)!;
    if (await count(table) !== expected || await count(table, user.id) !== expected) {
      throw new Error(`Legacy relationship verification failed for ${table}`);
    }
    dataFingerprints.set(table, await fingerprint(table));
  }

  const [legacyLedger] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id",
  );
  const [v2Ledger] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT id, name, hash, created_at FROM __uptrail_v2_migrations ORDER BY id",
  );
  if (legacyLedger.length !== 1 || v2Ledger.length !== 2) throw new Error("Migration ledger state mismatch");
  return {
    userId: user.id,
    openId: user.openId,
    dataFingerprints,
    legacyLedger: JSON.stringify(legacyLedger),
    v2Ledger: JSON.stringify(v2Ledger),
  };
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
  const tls = await verifyTls();
  const before = await collectEvidence();
  console.log("Active database: defaultdb");
  console.log(`TLS: ${tls}`);
  console.log("Exact legacy identity match: PASS");
  console.log("Credential and email conflict checks: PASS");
  console.log("Legacy relationship and fingerprint checks: PASS");
  console.log("Migration ledger checks: PASS");

  if (mode === "preflight") {
    console.log("Legacy account-link preflight: PASS");
  } else {
    if (process.env.ALLOW_LEGACY_ACCOUNT_LINK !== "true"
      || process.env.CONFIRM_LEGACY_ACCOUNT_LINK_DATABASE !== "defaultdb") {
      throw new Error("Explicit defaultdb account-link authorization flags are required");
    }
    const backupFile = process.env.ACCOUNT_LINK_BACKUP_FILE;
    const backupHash = process.env.ACCOUNT_LINK_BACKUP_SHA256?.toLowerCase();
    if (!backupFile || !backupHash) throw new Error("Verified pre-link backup evidence is required");
    const actualBackupHash = createHash("sha256").update(await readFile(resolve(backupFile))).digest("hex");
    if (actualBackupHash !== backupHash) throw new Error("Pre-link backup checksum mismatch");

    const { hashPassword, normalizeEmail, verifyPassword } = await import("../server/_core/auth");
    const credential = await hashPassword(password);
    await connection.beginTransaction();
    try {
      await assertLiveTarget();
      const [lockedUsers] = await connection.execute<Array<{ id: number; openId: string } & mysql.RowDataPacket>>(
        "SELECT id, openId FROM users WHERE BINARY openId = BINARY ? FOR UPDATE",
        [openId],
      );
      if (lockedUsers.length !== 1 || lockedUsers[0]!.id !== before.userId || lockedUsers[0]!.openId !== before.openId) {
        throw new Error("Locked legacy identity no longer matches preflight");
      }
      const [conflicts] = await connection.execute<Array<{ rowCount: number | string } & mysql.RowDataPacket>>(
        "SELECT COUNT(*) AS rowCount FROM authCredentials WHERE userId = ? OR emailNormalized = ?",
        [before.userId, normalizeEmail(email)],
      );
      if (Number(conflicts[0]?.rowCount ?? -1) !== 0) throw new Error("Credential state changed after preflight");

      await assertLiveTarget();
      await connection.execute(
        `INSERT INTO authCredentials (userId, emailNormalized, passwordHash, passwordSalt)
         VALUES (?, ?, ?, ?)`,
        [before.userId, normalizeEmail(email), credential.hash, credential.salt],
      );
      await assertLiveTarget();
      const [updateResult] = await connection.execute<mysql.ResultSetHeader>(
        "UPDATE users SET email = ?, loginMethod = 'password' WHERE id = ? AND BINARY openId = BINARY ?",
        [email, before.userId, openId],
      );
      if (updateResult.affectedRows !== 1) throw new Error("Legacy user authentication update did not affect exactly one row");

      const [stored] = await connection.execute<Array<{
        userId: number;
        passwordHash: string;
        passwordSalt: string;
      } & mysql.RowDataPacket>>(
        "SELECT userId, passwordHash, passwordSalt FROM authCredentials WHERE userId = ?",
        [before.userId],
      );
      if (stored.length !== 1 || stored[0]!.userId !== before.userId
        || stored[0]!.passwordHash === password || stored[0]!.passwordSalt === password
        || !(await verifyPassword(password, stored[0]!.passwordHash, stored[0]!.passwordSalt))) {
        throw new Error("Stored credential verification failed");
      }
      for (const [table, beforeHash] of before.dataFingerprints) {
        if (await fingerprint(table) !== beforeHash) throw new Error(`Legacy data changed in ${table}`);
      }
      const [legacyLedgerAfter] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id",
      );
      const [v2LedgerAfter] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT id, name, hash, created_at FROM __uptrail_v2_migrations ORDER BY id",
      );
      if (JSON.stringify(legacyLedgerAfter) !== before.legacyLedger
        || JSON.stringify(v2LedgerAfter) !== before.v2Ledger) {
        throw new Error("Migration ledger changed during account linking");
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    console.log("Credential creation: PASS");
    console.log("Legacy numeric ID and openId preservation: PASS");
    console.log("Legacy learner-data fingerprints: unchanged");
    console.log("Migration ledgers: unchanged");
    console.log("Guarded legacy account link: PASS");
  }
} catch (error) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "link_guard_failure";
  console.error(`Guarded legacy account link failed (${code}); sensitive details were suppressed.`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
