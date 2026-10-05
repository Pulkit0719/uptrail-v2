import { resolve } from "node:path";
import { config } from "dotenv";
import mysql from "mysql2/promise";
import { getDatabaseConnectionOptions, parseDatabaseUrl } from "../server/_core/databaseConfig";

const DRYRUN_DATABASE = "uptrail_migration_dryrun";
const envResult = config({ path: resolve(".env.dryrun"), override: true, quiet: true });
if (envResult.error) throw new Error("Could not load .env.dryrun");

const databaseUrl = process.env.DATABASE_URL;
const caFile = process.env.DATABASE_SSL_CA_FILE;
if (!databaseUrl) throw new Error("DATABASE_URL is missing from .env.dryrun");
if (!caFile) throw new Error("DATABASE_SSL_CA_FILE is missing from .env.dryrun");

const parsed = parseDatabaseUrl(databaseUrl);
if (parsed.database !== DRYRUN_DATABASE) {
  throw new Error(`Refusing connection: dry-run target must be exactly ${DRYRUN_DATABASE}`);
}

let connection: mysql.Connection | undefined;
try {
  connection = await mysql.createConnection(getDatabaseConnectionOptions(databaseUrl, caFile));
  const [databaseRows] = await connection.query<Array<{ activeDatabase: string } & mysql.RowDataPacket>>(
    "SELECT DATABASE() AS activeDatabase",
  );
  const activeDatabase = databaseRows[0]?.activeDatabase;
  if (activeDatabase !== DRYRUN_DATABASE) {
    throw new Error(`Refusing verification: server selected an unexpected database`);
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
    `SELECT COUNT(*) AS tableCount
       FROM information_schema.tables
      WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
    [DRYRUN_DATABASE],
  );
  const tableCount = Number(tableRows[0]?.tableCount ?? 0);

  const [ledgerRows] = await connection.execute<Array<{ table_name: string } & mysql.RowDataPacket>>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
        AND table_name IN ('__drizzle_migrations', '__uptrail_v2_migrations')
      ORDER BY table_name`,
    [DRYRUN_DATABASE],
  );
  await connection.query("ROLLBACK");

  console.log(`Dry-run database name: ${activeDatabase}`);
  console.log(`Database connection: PASS`);
  console.log(`TLS certificate verification: PASS`);
  console.log(`TLS: ${tlsVersion} / ${tlsCipher}`);
  console.log(`Current table count: ${tableCount}`);
  console.log(`Migration ledger: ${ledgerRows.length === 0 ? "absent" : ledgerRows.map(row => row.table_name).join(", ")}`);
} catch (error) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "verification_error";
  console.error(`Dry-run database verification failed (${code}); secret connection details were suppressed.`);
  process.exitCode = 1;
} finally {
  await connection?.end();
}
