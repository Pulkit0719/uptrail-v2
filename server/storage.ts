import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

const MAX_SERVER_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/gif", "image/jpeg", "image/png", "image/webp",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm",
  "text/plain",
]);
const CONTENT_TYPE_EXTENSIONS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/gif": [".gif"],
  "image/jpeg": [".jpeg", ".jpg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "audio/mpeg": [".mp3"],
  "audio/mp4": [".m4a", ".mp4"],
  "audio/ogg": [".oga", ".ogg"],
  "audio/wav": [".wav"],
  "audio/webm": [".webm"],
  "text/plain": [".txt"],
};
let client: S3Client | undefined;

function requireBucket() {
  if (!ENV.s3Bucket) throw new Error("S3_BUCKET is not configured");
  if ((ENV.s3AccessKeyId && !ENV.s3SecretAccessKey) || (!ENV.s3AccessKeyId && ENV.s3SecretAccessKey)) {
    throw new Error("Configure both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or neither when using an IAM role");
  }
  return ENV.s3Bucket;
}

function getClient() {
  if (!client) {
    client = new S3Client({
      region: ENV.s3Region,
      ...(ENV.s3Endpoint ? { endpoint: ENV.s3Endpoint } : {}),
      forcePathStyle: ENV.s3ForcePathStyle,
      ...(ENV.s3AccessKeyId ? { credentials: { accessKeyId: ENV.s3AccessKeyId, secretAccessKey: ENV.s3SecretAccessKey } } : {}),
    });
  }
  return client;
}

export function normalizeStorageKey(value: string) {
  const key = value.replace(/^\/+/, "");
  if (!key || key.length > 512 || key.includes("..") || key.includes("\\") || !/^[A-Za-z0-9._/-]+$/.test(key)) {
    throw new Error("Invalid storage key");
  }
  return key;
}

export function validateStorageContentType(value: string) {
  const contentType = value.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error("Unsupported storage content type");
  }
  return contentType;
}

export function validateStorageUpload(key: string, value: string) {
  const contentType = validateStorageContentType(value);
  const lowerKey = key.toLowerCase();
  if (!CONTENT_TYPE_EXTENSIONS[contentType]?.some(extension => lowerKey.endsWith(extension))) {
    throw new Error("Storage key extension does not match content type");
  }
  return contentType;
}

function uniqueKey(relKey: string) {
  const key = normalizeStorageKey(relKey);
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const dot = key.lastIndexOf(".");
  return dot > key.lastIndexOf("/") ? `${key.slice(0, dot)}_${suffix}${key.slice(dot)}` : `${key}_${suffix}`;
}

function appUrl(key: string) {
  return `/storage/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const body = typeof data === "string" ? Buffer.from(data) : data;
  if (body.byteLength > MAX_SERVER_UPLOAD_BYTES) throw new Error("Upload exceeds the 25 MB server limit");
  const key = uniqueKey(relKey);
  const safeContentType = validateStorageUpload(key, contentType);
  await getClient().send(new PutObjectCommand({ Bucket: requireBucket(), Key: key, Body: body, ContentType: safeContentType }));
  return { key, url: appUrl(key) };
}

export async function storageGet(relKey: string) {
  const key = normalizeStorageKey(relKey);
  return { key, url: appUrl(key) };
}

export async function storageGetSignedUrl(relKey: string) {
  const key = normalizeStorageKey(relKey);
  const bucket = requireBucket();
  await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
}

export async function storageRead(relKey: string) {
  const key = normalizeStorageKey(relKey);
  const response = await getClient().send(new GetObjectCommand({ Bucket: requireBucket(), Key: key }));
  if (!response.Body) throw new Error("Storage object has no body");
  return { data: Buffer.from(await response.Body.transformToByteArray()), contentType: response.ContentType ?? "application/octet-stream" };
}

export async function storageCreateUploadUrl(relKey: string, contentType: string, contentLength: number) {
  if (!Number.isInteger(contentLength) || contentLength < 1 || contentLength > MAX_SERVER_UPLOAD_BYTES) {
    throw new Error("Upload length must be between 1 byte and 25 MB");
  }
  const key = uniqueKey(relKey);
  const command = new PutObjectCommand({ Bucket: requireBucket(), Key: key, ContentType: validateStorageUpload(key, contentType), ContentLength: contentLength });
  return { key, url: appUrl(key), uploadUrl: await getSignedUrl(getClient(), command, { expiresIn: 300 }) };
}
