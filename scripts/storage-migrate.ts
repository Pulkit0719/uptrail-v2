import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Transform, type Readable } from "node:stream";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ENV } from "../server/_core/env";

type ManifestItem = {
  key: string;
  size: number;
  sourceEtag?: string;
  destinationEtag?: string;
  sourceSha256?: string;
  destinationSha256?: string;
  status: "planned" | "copied" | "verified" | "failed";
  error?: string;
};

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const sourceBucket = required("SOURCE_S3_BUCKET");
if (!ENV.s3Bucket) throw new Error("S3_BUCKET is required for the destination");
const execute = process.env.STORAGE_MIGRATION_EXECUTE === "true";
const sourcePrefix = process.env.SOURCE_S3_PREFIX ?? "";
const destinationPrefix = process.env.DESTINATION_S3_PREFIX ?? "";

const client = (prefix: "SOURCE_" | "") => new S3Client({
  region: process.env[`${prefix}S3_REGION`] ?? "us-east-1",
  ...(process.env[`${prefix}S3_ENDPOINT`] ? { endpoint: process.env[`${prefix}S3_ENDPOINT`] } : {}),
  forcePathStyle: process.env[`${prefix}S3_FORCE_PATH_STYLE`] === "true",
  ...(process.env[`${prefix}S3_ACCESS_KEY_ID`] ? {
    credentials: {
      accessKeyId: required(`${prefix}S3_ACCESS_KEY_ID`),
      secretAccessKey: required(`${prefix}S3_SECRET_ACCESS_KEY`),
    },
  } : {}),
});
const source = client("SOURCE_");
const destination = client("");

async function hashObject(s3: S3Client, bucket: string, key: string) {
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) throw new Error(`Object ${key} has no body`);
  const hash = createHash("sha256");
  for await (const chunk of object.Body as Readable) hash.update(chunk);
  return hash.digest("hex");
}

const manifest: ManifestItem[] = [];
let continuationToken: string | undefined;
do {
  const page = await source.send(new ListObjectsV2Command({
    Bucket: sourceBucket,
    Prefix: sourcePrefix,
    ContinuationToken: continuationToken,
  }));
  for (const object of page.Contents ?? []) {
    if (!object.Key || object.Size === undefined) continue;
    manifest.push({ key: object.Key, size: object.Size, sourceEtag: object.ETag, status: "planned" });
  }
  continuationToken = page.NextContinuationToken;
} while (continuationToken);

console.log(`Inventoried ${manifest.length} source objects (${execute ? "copy enabled" : "dry run"}).`);
if (execute) {
  for (const item of manifest) {
    const destinationKey = `${destinationPrefix}${item.key.slice(sourcePrefix.length)}`;
    try {
      const object = await source.send(new GetObjectCommand({ Bucket: sourceBucket, Key: item.key }));
      if (!object.Body) throw new Error("Source object has no body");
      const sourceHash = createHash("sha256");
      const hashingStream = new Transform({
        transform(chunk, _encoding, callback) {
          sourceHash.update(chunk);
          callback(null, chunk);
        },
      });
      (object.Body as Readable).pipe(hashingStream);
      const copied = await destination.send(new PutObjectCommand({
        Bucket: ENV.s3Bucket,
        Key: destinationKey,
        Body: hashingStream,
        ContentLength: item.size,
        ContentType: object.ContentType,
        CacheControl: object.CacheControl,
        ContentDisposition: object.ContentDisposition,
        Metadata: object.Metadata,
      }));
      item.status = "copied";
      item.sourceSha256 = sourceHash.digest("hex");
      item.destinationEtag = copied.ETag;
      const head = await destination.send(new HeadObjectCommand({ Bucket: ENV.s3Bucket, Key: destinationKey }));
      if (head.ContentLength !== item.size) throw new Error(`Size mismatch: expected ${item.size}, received ${head.ContentLength}`);
      item.destinationSha256 = await hashObject(destination, ENV.s3Bucket, destinationKey);
      if (item.destinationSha256 !== item.sourceSha256) throw new Error("SHA-256 checksum mismatch");
      item.status = "verified";
      console.log(`verified: ${item.key}`);
    } catch (error) {
      item.status = "failed";
      item.error = error instanceof Error ? error.message : "Unknown migration failure";
      console.error(`failed: ${item.key}`);
    }
  }
}

await mkdir("migration-artifacts", { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const path = join("migration-artifacts", `storage-manifest-${stamp}.json`);
const temporaryPath = `${path}.tmp`;
const summary = {
  generatedAt: new Date().toISOString(),
  mode: execute ? "execute" : "dry-run",
  sourceBucket,
  destinationBucket: ENV.s3Bucket,
  sourcePrefix,
  destinationPrefix,
  counts: {
    total: manifest.length,
    verified: manifest.filter(item => item.status === "verified").length,
    failed: manifest.filter(item => item.status === "failed").length,
  },
  objects: manifest,
};
await writeFile(temporaryPath, `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
await rename(temporaryPath, path);
console.log(`Manifest written to ${path}`);
if (manifest.some(item => item.status === "failed")) process.exitCode = 1;
