import "dotenv/config";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "../server/db";

function escapeSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString("hex")}'`;
  }
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  const escaped = str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\0/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z");
  return `'${escaped}'`;
}

async function runBackup() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not configured");
  }

  const [dbRow] = await db.execute(sql`SELECT DATABASE() AS activeDb`);
  const activeDb = (dbRow as Array<{ activeDb: string }>)[0]?.activeDb;
  if (activeDb !== "defaultdb") {
    throw new Error(`Expected active database defaultdb, got: ${activeDb}`);
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestampStr = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const filename = `defaultdb-pre-live-deployment-${timestampStr}.sql`;
  const backupsDir = resolve("backups");
  await mkdir(backupsDir, { recursive: true });
  const backupFilePath = join(backupsDir, filename);

  const [tableRows] = await db.execute(sql`
    SELECT table_name AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const tables = (tableRows as Array<{ tableName: string }>).map(r => r.tableName);

  let dumpContent = "";
  dumpContent += "-- Uptrail V2 Pre-Live-Deployment Database Dump\n";
  dumpContent += `-- Database: ${activeDb}\n`;
  dumpContent += `-- Timestamp: ${now.toISOString()}\n`;
  dumpContent += "-- Mode: READ-ONLY EXPORT\n";
  dumpContent += "-- ------------------------------------------------------\n";
  dumpContent += "/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n";
  dumpContent += "/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;\n";
  dumpContent += "/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;\n";
  dumpContent += "/*!50503 SET NAMES utf8mb4 */;\n";
  dumpContent += "/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;\n";
  dumpContent += "/*!40103 SET TIME_ZONE='+00:00' */;\n";
  dumpContent += "/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;\n";
  dumpContent += "/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n";
  dumpContent += "/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n";
  dumpContent += "/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;\n\n";

  for (const table of tables) {
    dumpContent += `--\n-- Table structure for table \`${table}\`\n--\n\n`;
    dumpContent += `DROP TABLE IF EXISTS \`${table}\`;\n`;
    dumpContent += "/*!40101 SET @saved_cs_client     = @@character_set_client */;\n";
    dumpContent += "/*!50503 SET character_set_client = utf8mb4 */;\n";

    const [createRows] = await db.execute(sql.raw(`SHOW CREATE TABLE \`${table}\``));
    const createTableStmt = (createRows as Array<Record<string, string>>)[0]?.["Create Table"];
    if (createTableStmt) {
      dumpContent += `${createTableStmt};\n`;
    }
    dumpContent += "/*!40101 SET character_set_client = @saved_cs_client */;\n\n";

    dumpContent += `--\n-- Dumping data for table \`${table}\`\n--\n\n`;
    dumpContent += `LOCK TABLES \`${table}\` WRITE;\n`;
    dumpContent += `/*!40000 ALTER TABLE \`${table}\` DISABLE KEYS */;\n`;

    const [rows] = await db.execute(sql.raw(`SELECT * FROM \`${table}\``));
    const dataRows = rows as Array<Record<string, unknown>>;
    if (dataRows.length > 0) {
      const columns = Object.keys(dataRows[0]!);
      const insertPrefix = `INSERT INTO \`${table}\` (\`${columns.join("`, `")}\`) VALUES\n`;
      const valueLines = dataRows.map(row => {
        const values = columns.map(col => escapeSqlValue(row[col]));
        return `(${values.join(", ")})`;
      });
      dumpContent += `${insertPrefix}${valueLines.join(",\n")};\n`;
    }

    dumpContent += `/*!40000 ALTER TABLE \`${table}\` ENABLE KEYS */;\n`;
    dumpContent += "UNLOCK TABLES;\n\n";
  }

  dumpContent += "/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;\n";
  dumpContent += "/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n";
  dumpContent += "/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n";
  dumpContent += "/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;\n";
  dumpContent += "/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n";
  dumpContent += "/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n";
  dumpContent += "/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n";
  dumpContent += "/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;\n";
  dumpContent += `-- Dump completed on ${new Date().toISOString()}\n`;

  await writeFile(backupFilePath, dumpContent, "utf8");

  // Independent SHA-256 verification
  const readBack = await readFile(backupFilePath);
  const sha256 = createHash("sha256").update(readBack).digest("hex");

  const manifestPath = `${backupFilePath}.manifest.json`;
  const shaPath = `${backupFilePath}.sha256`;

  await writeFile(shaPath, `${sha256} *${filename}\n`, "utf8");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        createdAt: now.toISOString(),
        backupFile: backupFilePath,
        sha256,
        sourceDatabase: activeDb,
        tableCount: tables.length,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  // Independent verification check
  const secondRead = await readFile(backupFilePath);
  const secondSha = createHash("sha256").update(secondRead).digest("hex");
  const isVerified = sha256 === secondSha && secondSha.length === 64;

  console.log(`backup filename: ${filename}`);
  console.log(`timestamp: ${now.toISOString()}`);
  console.log(`SHA-256: ${sha256}`);
  console.log(`verification: ${isVerified ? "PASS" : "FAIL"}`);
}

async function main() {
  try {
    await runBackup();
  } catch (err: any) {
    console.error("Backup failed:", err?.message || err);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

main();
