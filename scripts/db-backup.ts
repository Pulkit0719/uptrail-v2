import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { backupDatabase } from "./db-cli";
import { parseDatabaseUrl } from "../server/_core/databaseConfig";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const output = process.env.BACKUP_FILE ?? join("backups", `uptrail-${stamp}.sql`);
const parsed = parseDatabaseUrl(databaseUrl);
if (process.env.EXPECTED_DATABASE_NAME && parsed.database !== process.env.EXPECTED_DATABASE_NAME) {
  throw new Error("Backup target does not match EXPECTED_DATABASE_NAME");
}
console.log(`Creating backup at ${output}`);
const backupPath = await backupDatabase(databaseUrl, output);
const firstRead = await readFile(backupPath);
const sha256 = createHash("sha256").update(firstRead).digest("hex");
const verifiedSha256 = createHash("sha256").update(await readFile(backupPath)).digest("hex");
if (sha256 !== verifiedSha256) throw new Error("Backup checksum verification failed");

const checksumPath = `${backupPath}.sha256`;
const manifestPath = `${backupPath}.manifest.json`;
await writeFile(checksumPath, `${sha256} *${basename(backupPath)}\n`, { encoding: "utf8", flag: "wx" });
await writeFile(manifestPath, `${JSON.stringify({
  createdAt: new Date().toISOString(),
  backupFile: resolve(backupPath),
  sha256,
  sourceDatabase: parsed.database,
}, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(`Backup completed: ${backupPath}`);
console.log(`SHA-256: ${sha256}`);
console.log(`Checksum verification: PASS`);
console.log(`Manifest: ${manifestPath}`);
