import "dotenv/config";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { backupDatabase, parseMysqlUrl, runDatabaseTool } from "./db-cli";

const restoreUrl = process.env.RESTORE_DATABASE_URL;
const restoreFile = process.env.RESTORE_FILE;
if (!restoreUrl || !restoreFile) throw new Error("RESTORE_DATABASE_URL and RESTORE_FILE are required");
if (process.env.ALLOW_RESTORE !== "true") throw new Error("Set ALLOW_RESTORE=true to acknowledge this destructive operation");
if (restoreUrl === process.env.DATABASE_URL && process.env.ALLOW_PRIMARY_RESTORE !== "true") {
  throw new Error("Target matches DATABASE_URL; set ALLOW_PRIMARY_RESTORE=true only for an approved primary recovery");
}
const connection = parseMysqlUrl(restoreUrl);
if (process.env.RESTORE_CONFIRM_DATABASE !== connection.database) {
  throw new Error("RESTORE_CONFIRM_DATABASE must exactly match the target database name");
}
const source = resolve(restoreFile);
await access(source);
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const safetyBackup = join("backups", `pre-restore-${connection.database}-${stamp}.sql`);
console.log(`Creating mandatory pre-restore backup at ${safetyBackup}`);
await backupDatabase(restoreUrl, safetyBackup);
console.log(`Restoring ${source} into confirmed database ${connection.database}`);
await runDatabaseTool("mysql", [
  `--host=${connection.host}`, `--port=${connection.port}`, `--user=${connection.user}`, connection.database,
], connection.password, { inputFile: source });
console.log("Restore completed. Run pnpm db:integrity before using the database.");
