import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getStorageConfig } from "@/lib/env";

/**
 * One S3-compatible client serves Cloudflare R2, AWS S3 and Neon Object
 * Storage — they all speak the S3 API, so only the endpoint and region differ
 * (`auto` for R2, `us-east-1` for Neon).
 *
 * Constructed lazily so importing this module without credentials is free and
 * `next build` does not require storage to be configured.
 */
let client: S3Client | null = null;
let clientKey = "";

function getClient(): S3Client | null {
  const config = getStorageConfig();
  if (!config) return null;

  // Rebuild when the configuration changes so a pulled `.env` is picked up
  // without restarting the server.
  const key = `${config.endpoint}|${config.region}|${config.accessKeyId}`;
  if (client && clientKey === key) return client;

  clientKey = key;
  client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // R2 and Neon both require path-style addressing.
    forcePathStyle: true,
  });
  return client;
}

/** Strips path separators and unsafe characters from a user-supplied name. */
export function sanitiseFileName(fileName: string): string {
  return (
    fileName
      .replace(/[\\/]/g, "_")
      .replace(/[^\w.\- ]+/g, "")
      .replace(/\s+/g, "_")
      .slice(-120) || "file"
  );
}

export function buildObjectKey(
  courseId: string,
  scope: string,
  fileName: string,
): string {
  const unique = crypto.randomUUID();
  return `courses/${courseId}/${scope}/${unique}-${sanitiseFileName(fileName)}`;
}

/**
 * Presigned PUT so the browser uploads straight to the bucket — the file never
 * transits this server, which is what keeps large attachments off the Vercel
 * function body limit.
 */
export async function createUploadUrl(params: {
  key: string;
  mimeType: string;
  size: number;
}): Promise<string | null> {
  const config = getStorageConfig();
  const s3 = getClient();
  if (!s3 || !config) return null;

  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: params.key,
      ContentType: params.mimeType,
      ContentLength: params.size,
    }),
    { expiresIn: 300 },
  );
}

/**
 * Always a signed GET valid for an hour.
 *
 * A public bucket URL would never expire, which would defeat the authorised
 * `/api/files/[id]` route and leave student work readable by anyone holding a
 * link. The bucket is expected to stay private.
 */
export async function resolveFileUrl(key: string): Promise<string | null> {
  const config = getStorageConfig();
  const s3 = getClient();
  if (!s3 || !config) return null;

  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn: 3600 },
  );
}

export async function deleteObject(key: string): Promise<void> {
  const config = getStorageConfig();
  const s3 = getClient();
  if (!s3 || !config) return;

  try {
    await s3.send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
    );
  } catch (error) {
    // The database row is the source of truth for the UI; a failed bucket
    // delete leaves an orphan object but must not fail the user's action.
    console.error("[storage] Could not delete object", key, error);
  }
}
