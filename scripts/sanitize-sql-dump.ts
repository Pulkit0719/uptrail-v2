import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";

const [sourcePath, checksumPath, outputPath] = process.argv.slice(2);
if (!sourcePath || !checksumPath || !outputPath) {
  throw new Error("Usage: tsx scripts/sanitize-sql-dump.ts <dump.sql> <checksum-file> <output.sql>");
}

try {
  await access(outputPath);
  throw new Error("Refusing to overwrite an existing sanitized dump");
} catch (error) {
  if (error instanceof Error && error.message.startsWith("Refusing")) throw error;
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const [source, checksumFile] = await Promise.all([
  readFile(sourcePath),
  readFile(checksumPath, "utf8"),
]);
const expectedChecksum = checksumFile.match(/\b[a-fA-F0-9]{64}\b/)?.[0]?.toLowerCase();
if (!expectedChecksum) throw new Error("Checksum file does not contain a SHA-256 digest");
const sourceChecksum = createHash("sha256").update(source).digest("hex");
if (sourceChecksum !== expectedChecksum) throw new Error("Source checksum verification failed");

let sql = source.toString("utf8");
const forbidden = [
  /^\s*(?:CREATE|DROP)\s+DATABASE\b/gim,
  /^\s*USE\s+`?[^`;]+`?\s*;/gim,
  /\bDEFINER\s*=\s*/gim,
  /^\s*(?:CREATE|ALTER)\s+USER\b/gim,
  /^\s*(?:GRANT|REVOKE)\b/gim,
  /^\s*SET\s+(?:GLOBAL|PERSIST)\b/gim,
  /\b(?:SQL_LOG_BIN|GTID_PURGED)\b/gim,
];
if (forbidden.some(pattern => pattern.test(sql))) {
  throw new Error("Dump contains a forbidden server-level statement; no sanitized copy was written");
}

const transformations = [
  [/^\s*DROP\s+TABLE\s+IF\s+EXISTS\s+.+?;\s*$/gim, ""],
  [/^\s*LOCK\s+TABLES\s+.+?;\s*$/gim, ""],
  [/^\s*UNLOCK\s+TABLES\s*;\s*$/gim, ""],
  [/^\s*\/\*!40000\s+ALTER\s+TABLE\s+.+?\s+(?:DISABLE|ENABLE)\s+KEYS\s*\*\/;\s*$/gim, ""],
  [/\/\*T!\[clustered_index\]\s+CLUSTERED\s*\*\//gim, ""],
] as const;
for (const [pattern, replacement] of transformations) sql = sql.replace(pattern, replacement);
sql = sql.replace(/(?:\r?\n){3,}/g, "\n\n");

const output = Buffer.from(sql, "utf8");
const outputChecksum = createHash("sha256").update(output).digest("hex");
await writeFile(outputPath, output, { flag: "wx", mode: 0o600 });
await writeFile(`${outputPath}.sha256`, `${outputChecksum}  sanitized-dump.sql\n`, { flag: "wx", mode: 0o600 });

console.log("Sanitized dump created without changing application schema or row data.");
console.log(`Source checksum: PASS`);
console.log(`Sanitized size: ${output.length} bytes`);
console.log("Sanitized checksum sidecar: created");
