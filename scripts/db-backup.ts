import "dotenv/config";
import { join } from "node:path";
import { backupDatabase } from "./db-cli";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const output = process.env.BACKUP_FILE ?? join("backups", `uptrail-${stamp}.sql`);
console.log(`Creating backup at ${output}`);
console.log(`Backup completed: ${await backupDatabase(databaseUrl, output)}`);
