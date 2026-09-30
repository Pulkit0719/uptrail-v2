import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { parse } from "dotenv";

const secretEntries = [".env", ".env.dryrun"].flatMap(file => {
  const values = parse(readFileSync(file, "utf8"));
  return Object.entries(values)
    .filter(([key, value]) => /(?:DATABASE_URL|PASSWORD|SECRET|API_KEY|ACCESS_KEY|DATABASE_SSL_CA_FILE)/i.test(key) && value.length >= 8)
    .map(([key, value]) => ({ source: file, key, value }));
});
const secretValues = secretEntries.map(entry => entry.value);
if (secretValues.length < 4) throw new Error("Database security scan inputs are incomplete");

const containsSecret = (content: Buffer) => secretValues.some(value => content.includes(Buffer.from(value)));
const diff = Buffer.concat([
  execFileSync("git", ["diff", "--binary"], { encoding: "buffer" }),
  execFileSync("git", ["diff", "--cached", "--binary"], { encoding: "buffer" }),
]);
const diffContainsSecret = containsSecret(diff);

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const untrackedSourceFiles = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { encoding: "buffer" })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const sourceCandidates = [...trackedFiles, ...untrackedSourceFiles];
const trackedHits: Array<{ file: string; keys: string[] }> = [];
const trackedContainsSecret = sourceCandidates.some(file => {
  try {
    const content = readFileSync(file);
    const keys = secretEntries.filter(entry => content.includes(Buffer.from(entry.value))).map(entry => `${entry.source}:${entry.key}`);
    if (keys.length) trackedHits.push({ file, keys });
    return keys.length > 0;
  } catch {
    return false;
  }
});
const trackedDump = sourceCandidates.find(file => {
  const normalized = file.replaceAll("\\", "/");
  if (normalized.startsWith("drizzle/") || normalized.startsWith("drizzle-v2/")) return false;
  return /\.(?:sql|dump|bak|sha256)$/i.test(normalized);
});
const history = execFileSync("git", ["log", "--all", "-p", "--no-ext-diff"], {
  encoding: "buffer",
  maxBuffer: 64 * 1024 * 1024,
});
const historyContainsSecret = containsSecret(history);

const ignoredPaths = [".env", ".env.dryrun", "backups/probe.sql", "migration-artifacts/probe.json"];
const ignoredCorrectly = ignoredPaths.every(path => {
  try {
    execFileSync("git", ["check-ignore", "-q", path]);
    return true;
  } catch {
    return false;
  }
});

const logFiles: string[] = [];
function collectLogs(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectLogs(path);
    else if (entry.name.endsWith(".log") || path.split(sep).includes("logs")) logFiles.push(path);
  }
}
collectLogs(".");
const logsContainSecret = logFiles.some(file => {
  try {
    return containsSecret(readFileSync(file));
  } catch {
    return false;
  }
});

console.log(`Git diff secret exposure: ${diffContainsSecret ? "FAIL" : "PASS"}`);
console.log(`Source-candidate secret exposure: ${trackedContainsSecret ? "FAIL" : "PASS"}`);
console.log(`Generated-log secret exposure: ${logsContainSecret ? "FAIL" : "PASS"}`);
console.log(`Git-history secret exposure: ${historyContainsSecret ? "FAIL" : "PASS"}`);
console.log(`Tracked database dump exposure: ${trackedDump ? "FAIL" : "PASS"}`);
console.log(`Environment/backup ignore rules: ${ignoredCorrectly ? "PASS" : "FAIL"}`);
if (diffContainsSecret) {
  const diffKeys = secretEntries.filter(entry => diff.includes(Buffer.from(entry.value))).map(entry => `${entry.source}:${entry.key}`);
  console.log(`Git diff matching keys only: ${diffKeys.join(", ")}`);
}
if (trackedContainsSecret) {
  console.log(`Tracked matching locations only: ${trackedHits.map(hit => `${hit.file} (${hit.keys.join(", ")})`).join("; ")}`);
}
if (diffContainsSecret || trackedContainsSecret || logsContainSecret || historyContainsSecret || trackedDump || !ignoredCorrectly) {
  process.exitCode = 1;
}
