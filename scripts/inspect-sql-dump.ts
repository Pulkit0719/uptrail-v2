import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const [dumpPath, checksumPath] = process.argv.slice(2);
if (!dumpPath || !checksumPath) {
  throw new Error("Usage: tsx scripts/inspect-sql-dump.ts <dump.sql> <checksum-file>");
}

const [dump, checksumFile] = await Promise.all([
  readFile(dumpPath),
  readFile(checksumPath, "utf8"),
]);
const sqlText = dump.toString("utf8");
const expectedChecksum = checksumFile.match(/\b[a-fA-F0-9]{64}\b/)?.[0]?.toLowerCase();
if (!expectedChecksum) throw new Error("Checksum file does not contain a SHA-256 digest");
const actualChecksum = createHash("sha256").update(dump).digest("hex");

const unique = (values: Iterable<string>) => [...new Set(values)].sort();
const names = (pattern: RegExp) => unique([...sqlText.matchAll(pattern)].map(match => match[1]));

const tables = names(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([^`\s(]+)`?/gim);
const triggers = names(/^CREATE(?:\s+DEFINER\s*=\s*[^\s]+)?\s+TRIGGER\s+`?([^`\s]+)`?/gim);
const routines = names(/^CREATE(?:\s+DEFINER\s*=\s*[^\s]+)?\s+(?:PROCEDURE|FUNCTION)\s+`?([^`\s(]+)`?/gim);
const events = names(/^CREATE(?:\s+DEFINER\s*=\s*[^\s]+)?\s+EVENT\s+`?([^`\s]+)`?/gim);
const charsets = names(/(?:DEFAULT\s+)?CHARSET\s*=\s*([a-zA-Z0-9_]+)/gim);
const collations = names(/COLLATE\s*=\s*([a-zA-Z0-9_]+)/gim);
const versionGuards = unique([...sqlText.matchAll(/\/\*!([0-9]{5,6})/g)].map(match => match[1]));
const versionComments = unique(
  [...sqlText.matchAll(/^--\s*((?:MySQL dump|Server version).*?)\s*$/gim)].map(match => match[1]),
);

const rowCounts = new Map<string, number>();
const insertPattern = /INSERT\s+INTO\s+(?:`([^`]+)`|([a-zA-Z0-9_$]+))\s*(?:\([^;]*?\)\s*)?VALUES\s*/gim;
for (let match = insertPattern.exec(sqlText); match; match = insertPattern.exec(sqlText)) {
  const table = match[1] ?? match[2];
  let quote = "";
  let depth = 0;
  let rows = 0;
  let index = insertPattern.lastIndex;
  for (; index < sqlText.length; index += 1) {
    const character = sqlText[index];
    const next = sqlText[index + 1];
    if (quote) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote && next === quote) {
        index += 1;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
    } else if (character === "(") {
      if (depth === 0) rows += 1;
      depth += 1;
    } else if (character === ")") {
      depth = Math.max(0, depth - 1);
    } else if (character === ";" && depth === 0) {
      break;
    }
  }
  rowCounts.set(table, (rowCounts.get(table) ?? 0) + rows);
  insertPattern.lastIndex = index + 1;
}

const foreignKeys: string[] = [];
const columns: string[] = [];
const indexes: string[] = [];
const createTablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([^`\s(]+)`?\s*\(([\s\S]*?)\)\s*(?:ENGINE|;)/gim;
for (const tableMatch of sqlText.matchAll(createTablePattern)) {
  const sourceTable = tableMatch[1];
  const body = tableMatch[2];
  for (const line of body.split(/\r?\n/)) {
    const columnMatch = line.match(/^\s*`([^`]+)`\s+(.+?)(?:,)?\s*$/);
    if (columnMatch) columns.push(`${sourceTable}.${columnMatch[1]}: ${columnMatch[2].replace(/,$/, "")}`);
    const indexMatch = line.match(/^\s*((?:PRIMARY|UNIQUE)?\s*KEY\s+.+?)(?:,)?\s*$/i);
    if (indexMatch) indexes.push(`${sourceTable}: ${indexMatch[1].replace(/,$/, "")}`);
  }
  for (const keyMatch of body.matchAll(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+`?([^`\s(]+)`?\s*\(([^)]+)\)/gim)) {
    const sourceColumns = keyMatch[1].replaceAll("`", "").replaceAll(/\s+/g, "");
    const targetColumns = keyMatch[3].replaceAll("`", "").replaceAll(/\s+/g, "");
    foreignKeys.push(`${sourceTable}(${sourceColumns}) -> ${keyMatch[2]}(${targetColumns})`);
  }
}

const hazards = [
  ["CREATE DATABASE", /^\s*CREATE\s+DATABASE\b/gim],
  ["DROP DATABASE", /^\s*DROP\s+DATABASE\b/gim],
  ["DROP TABLE", /^\s*DROP\s+TABLE\b/gim],
  ["USE database", /^\s*USE\s+`?[^`;]+`?\s*;/gim],
  ["DEFINER clauses", /\bDEFINER\s*=\s*/gim],
  ["CREATE/ALTER USER", /^\s*(?:CREATE|ALTER)\s+USER\b/gim],
  ["GRANT/REVOKE", /^\s*(?:GRANT|REVOKE)\b/gim],
  ["SET GLOBAL/PERSIST", /^\s*SET\s+(?:GLOBAL|PERSIST)\b/gim],
  ["SQL_LOG_BIN", /\bSQL_LOG_BIN\b/gim],
  ["LOCK TABLES", /^\s*LOCK\s+TABLES\b/gim],
  ["UNLOCK TABLES", /^\s*UNLOCK\s+TABLES\b/gim],
  ["GTID_PURGED", /\bGTID_PURGED\b/gim],
  ["TiDB clustered-index comments", /\/\*T!\[clustered_index\][\s\S]*?\*\//gim],
  ["TiDB-specific DDL", /\b(?:AUTO_RANDOM|SHARD_ROW_ID_BITS|PRE_SPLIT_REGIONS|PLACEMENT\s+POLICY|TIDB_ROW_ID_SHARDING_INFO)\b/gim],
] as const;

const ledgerRecords: string[] = [];
for (const match of sqlText.matchAll(/INSERT\s+INTO\s+`?__drizzle_migrations`?\s+VALUES\s*\(\s*(\d+)\s*,\s*(['"])(?:\\.|(?!\2).)*\2\s*,\s*(\d+)\s*\)/gim)) {
  ledgerRecords.push(`id ${match[1]}, created_at ${match[3]}`);
}

console.log(`checksum: ${actualChecksum === expectedChecksum ? "PASS" : "FAIL"}`);
console.log(`size_bytes: ${dump.length}`);
console.log(`version_comments: ${versionComments.length ? versionComments.join(" | ") : "none"}`);
console.log(`version_guards: ${versionGuards.length ? versionGuards.join(", ") : "none"}`);
console.log(`tables (${tables.length}):`);
for (const table of tables) console.log(`- ${table}: approximately ${rowCounts.get(table) ?? 0} inserted rows`);
console.log(`foreign_keys (${foreignKeys.length}):`);
for (const key of foreignKeys.sort()) console.log(`- ${key}`);
console.log(`triggers (${triggers.length}): ${triggers.length ? triggers.join(", ") : "none"}`);
console.log(`routines (${routines.length}): ${routines.length ? routines.join(", ") : "none"}`);
console.log(`events (${events.length}): ${events.length ? events.join(", ") : "none"}`);
console.log(`drizzle_ledger: ${tables.includes("__drizzle_migrations") ? `present, approximately ${rowCounts.get("__drizzle_migrations") ?? 0} inserted rows` : "absent"}`);
for (const record of ledgerRecords) console.log(`- ${record}`);
console.log(`charsets: ${charsets.length ? charsets.join(", ") : "not declared"}`);
console.log(`collations: ${collations.length ? collations.join(", ") : "not declared"}`);
console.log(`columns (${columns.length}):`);
for (const column of columns) console.log(`- ${column}`);
console.log(`indexes (${indexes.length}):`);
for (const index of indexes) console.log(`- ${index}`);
console.log("restore_hazards:");
for (const [label, pattern] of hazards) console.log(`- ${label}: ${[...sqlText.matchAll(pattern)].length}`);
