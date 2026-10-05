import "dotenv/config";
import { ENV, validateConfiguration } from "../server/_core/env";

const report = validateConfiguration(process.argv.includes("--strict"));
const configured = (value: string) => (value ? "configured" : "not configured");

console.log("Uptrail configuration check (secret values are never printed)");
console.log(`database: ${configured(ENV.databaseUrl)}`);
console.log(`database CA certificate: ${configured(ENV.databaseSslCaFile || ENV.databaseSslCa)}`);
console.log(`AI provider: ${configured(ENV.aiApiKey)}`);
console.log(`AI base URL: ${configured(ENV.aiBaseUrl)}`);
console.log(`AI chat model: ${configured(ENV.aiChatModel)}`);
console.log(
  `AI paid fallback: ${ENV.aiBaseUrl.includes("openrouter.ai") && ENV.aiChatModel === "openrouter/free" ? "disabled" : "not enforced"}`
);
console.log(`email delivery: ${configured(ENV.emailProviderUrl)}`);
console.log(`owner role: ${ENV.ownerUserId ? "configured" : "not configured"}`);
for (const warning of report.warnings) console.warn(`warning: ${warning}`);
for (const error of report.errors) console.error(`error: ${error}`);
if (report.errors.length) process.exitCode = 1;
