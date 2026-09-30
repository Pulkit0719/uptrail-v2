import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { parseDatabaseUrl } from "../server/_core/databaseConfig";

const SOURCE_DATABASE = "defaultdb";
const DRYRUN_DATABASE = "uptrail_migration_dryrun";
const sourcePath = resolve(".env");
const destinationPath = resolve(".env.dryrun");

function replaceDatabaseName(databaseUrl: string): string {
  const source = parseDatabaseUrl(databaseUrl);
  if (source.database !== SOURCE_DATABASE) {
    throw new Error(`Refusing to derive dry-run configuration: source database is not ${SOURCE_DATABASE}`);
  }

  const schemeEnd = databaseUrl.indexOf("://");
  const pathStart = schemeEnd === -1 ? -1 : databaseUrl.indexOf("/", schemeEnd + 3);
  if (pathStart === -1) throw new Error("DATABASE_URL does not contain a database path");
  const queryStart = databaseUrl.indexOf("?", pathStart);
  const fragmentStart = databaseUrl.indexOf("#", pathStart);
  const suffixCandidates = [queryStart, fragmentStart].filter(index => index !== -1);
  const pathEnd = suffixCandidates.length > 0 ? Math.min(...suffixCandidates) : databaseUrl.length;
  const dryrunUrl = `${databaseUrl.slice(0, pathStart)}/${DRYRUN_DATABASE}${databaseUrl.slice(pathEnd)}`;

  const target = parseDatabaseUrl(dryrunUrl);
  const sourceUrl = new URL(databaseUrl);
  const targetUrl = new URL(dryrunUrl);
  if (target.database !== DRYRUN_DATABASE) throw new Error("Dry-run database substitution failed");
  for (const component of ["protocol", "username", "password", "hostname", "port", "search", "hash"] as const) {
    if (sourceUrl[component] !== targetUrl[component]) {
      throw new Error(`Dry-run database substitution changed URI ${component}`);
    }
  }
  return dryrunUrl;
}

function quoteEnvValue(value: string): string {
  return JSON.stringify(value);
}

const sourceText = await readFile(sourcePath, "utf8");
const source = parse(sourceText);
if (!source.DATABASE_URL) throw new Error("DATABASE_URL is missing from .env");
if (!source.DATABASE_SSL_CA_FILE) throw new Error("DATABASE_SSL_CA_FILE is missing from .env");

const dryrunUrl = replaceDatabaseName(source.DATABASE_URL);
const output = [
  `DATABASE_URL=${quoteEnvValue(dryrunUrl)}`,
  `DATABASE_SSL_CA_FILE=${quoteEnvValue(source.DATABASE_SSL_CA_FILE)}`,
  "",
].join("\n");

const roundTrip = parse(output);
if (roundTrip.DATABASE_URL !== dryrunUrl || roundTrip.DATABASE_SSL_CA_FILE !== source.DATABASE_SSL_CA_FILE) {
  throw new Error("Generated dry-run configuration did not round-trip safely");
}

await writeFile(destinationPath, output, { encoding: "utf8", flag: "wx", mode: 0o600 });
console.log(`Created .env.dryrun for ${DRYRUN_DATABASE}; secret values were not displayed.`);
