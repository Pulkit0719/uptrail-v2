import "dotenv/config";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import mysql from "mysql2/promise";
import { backupDatabase, parseMysqlUrl, runDatabaseTool } from "./db-cli";
import { getDatabaseConnectionOptions } from "../server/_core/databaseConfig";

const restoreUrl = process.env.RESTORE_DATABASE_URL
  ?? (process.env.RESTORE_USE_DATABASE_URL === "true" ? process.env.DATABASE_URL : undefined);
const restoreFile = process.env.RESTORE_FILE;
if (!restoreUrl || !restoreFile) {
  throw new Error("RESTORE_DATABASE_URL (or RESTORE_USE_DATABASE_URL=true) and RESTORE_FILE are required");
}
if (process.env.ALLOW_RESTORE !== "true") throw new Error("Set ALLOW_RESTORE=true to acknowledge this destructive operation");
if (restoreUrl === process.env.DATABASE_URL && process.env.ALLOW_PRIMARY_RESTORE !== "true") {
  throw new Error("Target matches DATABASE_URL; set ALLOW_PRIMARY_RESTORE=true only for an approved primary recovery");
}
const connection = parseMysqlUrl(restoreUrl);
if (process.env.RESTORE_CONFIRM_DATABASE !== connection.database) {
  throw new Error("RESTORE_CONFIRM_DATABASE must exactly match the target database name");
}
const expectedDatabase = process.env.RESTORE_EXPECTED_DATABASE_NAME;
if (!expectedDatabase || connection.database !== expectedDatabase) {
  throw new Error("RESTORE_EXPECTED_DATABASE_NAME must exactly match the parsed target database");
}

async function verifyLiveTarget(requireEmpty: boolean) {
  const live = await mysql.createConnection(getDatabaseConnectionOptions(restoreUrl!, process.env.DATABASE_SSL_CA_FILE));
  try {
    const [databaseRows] = await live.query<Array<{ activeDatabase: string } & mysql.RowDataPacket>>(
      "SELECT DATABASE() AS activeDatabase",
    );
    if (databaseRows[0]?.activeDatabase !== expectedDatabase) {
      throw new Error("Live restore target does not match RESTORE_EXPECTED_DATABASE_NAME");
    }
    const [tableRows] = await live.execute<Array<{ tableCount: number } & mysql.RowDataPacket>>(
      `SELECT COUNT(*) AS tableCount FROM information_schema.tables
        WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
      [expectedDatabase],
    );
    const tableCount = Number(tableRows[0]?.tableCount ?? -1);
    if (requireEmpty && tableCount !== 0) throw new Error("Restore target is not empty");
    console.log(`Live restore target verified: ${expectedDatabase}; tables: ${tableCount}`);
  } finally {
    await live.end();
  }
}

const source = resolve(restoreFile);
await access(source);
await verifyLiveTarget(process.env.RESTORE_REQUIRE_EMPTY === "true");
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const safetyBackup = join("backups", `pre-restore-${connection.database}-${stamp}.sql`);
console.log(`Creating mandatory pre-restore backup at ${safetyBackup}`);
await backupDatabase(restoreUrl, safetyBackup);
await verifyLiveTarget(process.env.RESTORE_REQUIRE_EMPTY === "true");
console.log(`Restoring ${source} into confirmed database ${connection.database}`);
await runDatabaseTool("mysql", [
  `--host=${connection.host}`, `--port=${connection.port}`, `--user=${connection.user}`,
  ...(connection.sslMode || process.env.DATABASE_SSL_CA_FILE
    ? [
        `--ssl-mode=${connection.sslMode === "VERIFY_CA" ? "VERIFY_CA" : "VERIFY_IDENTITY"}`,
        ...(process.env.DATABASE_SSL_CA_FILE ? [`--ssl-ca=${resolve(process.env.DATABASE_SSL_CA_FILE)}`] : []),
      ]
    : []),
  connection.database,
], connection.password, { inputFile: source });
console.log("Restore completed. Run pnpm db:integrity before using the database.");
