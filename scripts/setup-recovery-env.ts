import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { parseDatabaseUrl } from "../server/_core/databaseConfig";

const SOURCE_DATABASE = "defaultdb";
const RECOVERY_DATABASE = "uptrail_migration_recovery";
const sourcePath = resolve(".env");
const destinationPath = resolve(".env.recovery");

function replaceDatabaseName(databaseUrl: string): string {
  const source = parseDatabaseUrl(databaseUrl);
  if (source.database !== SOURCE_DATABASE) {
    throw new Error(`Refusing recovery configuration: source database is not ${SOURCE_DATABASE}`);
  }

  const schemeEnd = databaseUrl.indexOf("://");
  const pathStart = schemeEnd === -1 ? -1 : databaseUrl.indexOf("/", schemeEnd + 3);
  if (pathStart === -1) throw new Error("DATABASE_URL does not contain a database path");
  const suffixCandidates = [databaseUrl.indexOf("?", pathStart), databaseUrl.indexOf("#", pathStart)]
    .filter(index => index !== -1);
  const pathEnd = suffixCandidates.length > 0 ? Math.min(...suffixCandidates) : databaseUrl.length;
  const recoveryUrl = `${databaseUrl.slice(0, pathStart)}/${RECOVERY_DATABASE}${databaseUrl.slice(pathEnd)}`;

  const target = parseDatabaseUrl(recoveryUrl);
  const sourceUrl = new URL(databaseUrl);
  const targetUrl = new URL(recoveryUrl);
  if (target.database !== RECOVERY_DATABASE) throw new Error("Recovery database substitution failed");
  for (const component of ["protocol", "username", "password", "hostname", "port", "search", "hash"] as const) {
    if (sourceUrl[component] !== targetUrl[component]) {
      throw new Error(`Recovery database substitution changed URI ${component}`);
    }
  }
  return recoveryUrl;
}

const sourceText = await readFile(sourcePath, "utf8");
const source = parse(sourceText);
if (!source.DATABASE_URL) throw new Error("DATABASE_URL is missing from .env");
if (!source.DATABASE_SSL_CA_FILE) throw new Error("DATABASE_SSL_CA_FILE is missing from .env");

const recoveryUrl = replaceDatabaseName(source.DATABASE_URL);
const output = [
  `DATABASE_URL=${JSON.stringify(recoveryUrl)}`,
  `DATABASE_SSL_CA_FILE=${JSON.stringify(source.DATABASE_SSL_CA_FILE)}`,
  "",
].join("\n");
const roundTrip = parse(output);
if (roundTrip.DATABASE_URL !== recoveryUrl || roundTrip.DATABASE_SSL_CA_FILE !== source.DATABASE_SSL_CA_FILE) {
  throw new Error("Generated recovery configuration did not round-trip safely");
}

await writeFile(destinationPath, output, { encoding: "utf8", flag: "wx", mode: 0o600 });
console.log(`Created .env.recovery for ${RECOVERY_DATABASE}; secret values were not displayed.`);
