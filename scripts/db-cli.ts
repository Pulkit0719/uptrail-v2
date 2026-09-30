import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { parseDatabaseUrl } from "../server/_core/databaseConfig";

export function parseMysqlUrl(value: string) {
  return parseDatabaseUrl(value);
}

function mysqlTlsArgs(connection: ReturnType<typeof parseMysqlUrl>) {
  const caFile = process.env.DATABASE_SSL_CA_FILE;
  if (!connection.sslMode && !caFile) return [];
  return [
    `--ssl-mode=${connection.sslMode === "VERIFY_CA" ? "VERIFY_CA" : "VERIFY_IDENTITY"}`,
    ...(caFile ? [`--ssl-ca=${resolve(caFile)}`] : []),
  ];
}

export async function runDatabaseTool(command: "mysqldump" | "mysql", args: string[], password: string, options: { inputFile?: string } = {}) {
  const child = spawn(command, args, {
    stdio: options.inputFile ? ["pipe", "inherit", "inherit"] : "inherit",
    env: { ...process.env, MYSQL_PWD: password },
    windowsHide: true,
  });
  if (options.inputFile) {
    const { createReadStream } = await import("node:fs");
    createReadStream(options.inputFile).pipe(child.stdin!);
  }
  return new Promise<void>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

export async function backupDatabase(databaseUrl: string, outputFile: string) {
  const connection = parseMysqlUrl(databaseUrl);
  const destination = resolve(outputFile);
  await mkdir(dirname(destination), { recursive: true });
  const { access } = await import("node:fs/promises");
  try {
    await access(destination);
    throw new Error(`Refusing to overwrite existing backup: ${destination}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing")) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await runDatabaseTool("mysqldump", [
    `--host=${connection.host}`, `--port=${connection.port}`, `--user=${connection.user}`,
    ...mysqlTlsArgs(connection),
    "--single-transaction", "--routines", "--triggers", "--events", "--hex-blob",
    "--default-character-set=utf8mb4", "--set-gtid-purged=OFF", "--no-tablespaces",
    `--result-file=${destination}`, connection.database,
  ], connection.password);
  return destination;
}
