import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ConnectionOptions, SslOptions } from "mysql2";

const TLS_MODES = new Set(["REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY"]);

export type ParsedDatabaseUrl = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  sslMode?: string;
};

export function parseDatabaseUrl(value: string): ParsedDatabaseUrl {
  const url = new URL(value);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must use mysql://");

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database) {
    throw new Error("DATABASE_URL must include a host and database name");
  }

  const sslMode = url.searchParams.get("ssl-mode")?.toUpperCase();
  if (sslMode && !TLS_MODES.has(sslMode)) {
    throw new Error("DATABASE_URL ssl-mode must be REQUIRED, VERIFY_CA, or VERIFY_IDENTITY");
  }

  return {
    host: decodeURIComponent(url.hostname),
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    sslMode,
  };
}

export function loadDatabaseSslOptions(
  database: ParsedDatabaseUrl,
  caFile = process.env.DATABASE_SSL_CA_FILE,
  caDirect = process.env.DATABASE_SSL_CA,
): SslOptions | undefined {
  if (!database.sslMode && !caFile && !caDirect) return undefined;

  let ca: string | undefined;
  try {
    ca = caDirect || (caFile ? readFileSync(resolve(caFile), "utf8") : undefined);
  } catch {
    throw new Error("DATABASE_SSL_CA_FILE could not be read");
  }
  if ((caFile || caDirect) && !ca?.includes("BEGIN CERTIFICATE")) {
    throw new Error("DATABASE_SSL_CA must contain a PEM certificate");
  }

  return {
    ...(ca ? { ca } : {}),
    rejectUnauthorized: true,
    verifyIdentity: database.sslMode !== "VERIFY_CA",
  };
}

export function getDatabaseConnectionOptions(
  databaseUrl: string,
  caFile = process.env.DATABASE_SSL_CA_FILE,
  caDirect = process.env.DATABASE_SSL_CA,
): ConnectionOptions {
  const database = parseDatabaseUrl(databaseUrl);
  return {
    host: database.host,
    port: database.port,
    user: database.user,
    password: database.password,
    database: database.database,
    ssl: loadDatabaseSslOptions(database, caFile, caDirect),
  };
}

export function redactDatabaseError(error: unknown, databaseUrl: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if (!databaseUrl) return message;
  const redacted = message.replaceAll(databaseUrl, "[REDACTED_DATABASE_URL]");
  try {
    const parsed = parseDatabaseUrl(databaseUrl);
    return parsed.password ? redacted.replaceAll(parsed.password, "[REDACTED]") : redacted;
  } catch {
    return redacted;
  }
}
