const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerUserId: process.env.OWNER_USER_ID ? Number(process.env.OWNER_USER_ID) : undefined,
  isProduction: process.env.NODE_ENV === "production",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  trustProxy: process.env.TRUST_PROXY === "true",
  databasePoolSize: positiveInteger(process.env.DATABASE_POOL_SIZE, 10),
  aiBaseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  aiApiKey: process.env.AI_API_KEY ?? "",
  aiChatModel: process.env.AI_CHAT_MODEL ?? "gpt-5-mini",
  aiImageModel: process.env.AI_IMAGE_MODEL ?? "gpt-image-1",
  aiTranscriptionModel: process.env.AI_TRANSCRIPTION_MODEL ?? "whisper-1",
  aiRequestTimeoutMs: positiveInteger(process.env.AI_REQUEST_TIMEOUT_MS, 30_000),
  aiMaxOutputTokens: positiveInteger(process.env.AI_MAX_OUTPUT_TOKENS, 800),
  aiMaxRetries: Math.min(positiveInteger(process.env.AI_MAX_RETRIES, 2), 3),
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  s3AllowInsecureHttp: process.env.S3_ALLOW_INSECURE_HTTP === "true",
  notificationWebhookUrl: process.env.NOTIFICATION_WEBHOOK_URL ?? "",
  emailProviderUrl: process.env.EMAIL_PROVIDER_URL ?? "",
  emailProviderApiKey: process.env.EMAIL_PROVIDER_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  passwordResetTtlMinutes: Math.min(positiveInteger(process.env.PASSWORD_RESET_TTL_MINUTES, 30), 120),
};

const validHttpUrl = (value: string, requireHttps: boolean) => {
  try {
    const url = new URL(value);
    if (!new Set(["http:", "https:"]).has(url.protocol)) return false;
    if (!requireHttps || url.protocol === "https:") return true;
    return new Set(["localhost", "127.0.0.1", "[::1]"]).has(url.hostname);
  } catch {
    return false;
  }
};

export type ConfigurationReport = { errors: string[]; warnings: string[] };

export function validateConfiguration(strict = ENV.isProduction): ConfigurationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issue = (message: string) => (strict ? errors : warnings).push(message);

  if (!ENV.databaseUrl) issue("DATABASE_URL is required.");
  if (ENV.ownerUserId !== undefined && (!Number.isSafeInteger(ENV.ownerUserId) || ENV.ownerUserId < 1)) {
    errors.push("OWNER_USER_ID must be a positive integer.");
  }
  if (!validHttpUrl(ENV.appBaseUrl, ENV.isProduction)) {
    errors.push("APP_BASE_URL must be a valid URL and must use HTTPS in production.");
  }
  if (!validHttpUrl(ENV.aiBaseUrl, ENV.isProduction)) {
    errors.push("AI_BASE_URL must be a valid URL and must use HTTPS in production.");
  }
  const storageValues = [ENV.s3Bucket, ENV.s3AccessKeyId, ENV.s3SecretAccessKey];
  if (storageValues.some(Boolean) && !ENV.s3Bucket) errors.push("S3_BUCKET is required when storage is configured.");
  if (Boolean(ENV.s3AccessKeyId) !== Boolean(ENV.s3SecretAccessKey)) {
    errors.push("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together.");
  }
  if (ENV.s3Endpoint && !validHttpUrl(ENV.s3Endpoint, ENV.isProduction && !ENV.s3AllowInsecureHttp)) {
    errors.push("S3_ENDPOINT must be valid and use HTTPS in production unless S3_ALLOW_INSECURE_HTTP=true for an isolated internal network.");
  }
  const emailValues = [ENV.emailProviderUrl, ENV.emailProviderApiKey, ENV.emailFrom];
  if (emailValues.some(Boolean) && emailValues.some(value => !value)) {
    errors.push("EMAIL_PROVIDER_URL, EMAIL_PROVIDER_API_KEY, and EMAIL_FROM must be configured together.");
  }
  if (ENV.emailProviderUrl && !validHttpUrl(ENV.emailProviderUrl, ENV.isProduction)) {
    errors.push("EMAIL_PROVIDER_URL must be a valid URL and must use HTTPS in production.");
  }
  if (ENV.notificationWebhookUrl && !validHttpUrl(ENV.notificationWebhookUrl, ENV.isProduction)) {
    errors.push("NOTIFICATION_WEBHOOK_URL must be a valid URL and must use HTTPS in production.");
  }
  if (!ENV.aiApiKey) warnings.push("AI_API_KEY is not configured; AI features will be unavailable.");
  if (!ENV.s3Bucket) warnings.push("S3 storage is not configured; media features will be unavailable.");
  if (!ENV.emailProviderUrl) warnings.push("Email delivery is not configured; password reset requests cannot be delivered.");
  return { errors, warnings };
}
