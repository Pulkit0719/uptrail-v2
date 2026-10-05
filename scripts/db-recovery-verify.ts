import { resolve } from "node:path";
import { config } from "dotenv";
import mysql from "mysql2/promise";
import { getDatabaseConnectionOptions, parseDatabaseUrl } from "../server/_core/databaseConfig";

const RECOVERY_DATABASE = "uptrail_migration_recovery";
const envResult = config({ path: resolve(".env.recovery"), override: true, quiet: true });
if (envResult.error) throw new Error("Could not load .env.recovery");
const databaseUrl = process.env.DATABASE_URL;
const caFile = process.env.DATABASE_SSL_CA_FILE;
if (!databaseUrl || !caFile) throw new Error("Recovery database TLS configuration is incomplete");
const parsed = parseDatabaseUrl(databaseUrl);
if (parsed.database !== RECOVERY_DATABASE) {
  throw new Error(`Refusing connection: recovery target must be exactly ${RECOVERY_DATABASE}`);
}

let connection: mysql.Connection | undefined;
try {
  connection = await mysql.createConnection(getDatabaseConnectionOptions(databaseUrl, caFile));
  const [databaseRows] = await connection.query<Array<{ activeDatabase: string } & mysql.RowDataPacket>>(
    "SELECT DATABASE() AS activeDatabase",
  );
  if (databaseRows[0]?.activeDatabase !== RECOVERY_DATABASE) {
    throw new Error("Live recovery database name does not match the required target");
  }
  await connection.query("START TRANSACTION READ ONLY");
  const [tlsRows] = await connection.query<Array<{ Variable_name: string; Value: string } & mysql.RowDataPacket>>(
    "SHOW SESSION STATUS WHERE Variable_name IN ('Ssl_cipher', 'Ssl_version')",
  );
  const tls = new Map(tlsRows.map(row => [row.Variable_name, row.Value]));
  const tlsVersion = tls.get("Ssl_version") ?? "";
  const tlsCipher = tls.get("Ssl_cipher") ?? "";
  if (!tlsVersion || !tlsCipher) throw new Error("Connection did not negotiate TLS");
  const [tableRows] = await connection.execute<Array<{ tableCount: number } & mysql.RowDataPacket>>(
    `SELECT COUNT(*) AS tableCount FROM information_schema.tables
      WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
    [RECOVERY_DATABASE],
  );
  const [ledgerRows] = await connection.execute<Array<{ tableName: string } & mysql.RowDataPacket>>(
    `SELECT table_name AS tableName FROM information_schema.tables
      WHERE table_schema = ? AND table_name IN ('__drizzle_migrations', '__uptrail_v2_migrations')
      ORDER BY table_name`,
    [RECOVERY_DATABASE],
  );
  await connection.query("ROLLBACK");
  console.log(`Recovery database name: ${RECOVERY_DATABASE}`);
  console.log("Database connection: PASS");
  console.log("TLS certificate verification: PASS");
  console.log(`TLS: ${tlsVersion} / ${tlsCipher}`);
  console.log(`Current table count: ${Number(tableRows[0]?.tableCount ?? 0)}`);
  console.log(`Migration ledger: ${ledgerRows.length ? ledgerRows.map(row => row.tableName).join(", ") : "absent"}`);
} catch (error) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "verification_error";
  console.error(`Recovery database verification failed (${code}); connection details were suppressed.`);
  process.exitCode = 1;
} finally {
  await connection?.end();
}
