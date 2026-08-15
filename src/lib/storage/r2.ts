import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { isStorageConfigured } from "@/lib/env";

/**
 * One S3-compatible client serves both Cloudflare R2 and AWS S3 — R2 speaks the
 * S3 API, so only the endpoint and region differ (`auto` for R2).
 *
 * Constructed lazily so importing this module without credentials is free and
 * `next build` does not require storage to be configured.
 */
let client: S3Client | null = null;

function getClient(): S3Client | null {
  if (!isStorageConfigured()) return null;
  if (client) return client;

  client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    // R2 requires path-style addressing.
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
  const s3 = getClient();
  if (!s3) return null;

  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: params.key,
      ContentType: params.mimeType,
      ContentLength: params.size,
    }),
    { expiresIn: 300 },
  );
}

/**
 * Public URL when the bucket is served from a domain, otherwise a signed GET
 * valid for an hour.
 */
export async function resolveFileUrl(key: string): Promise<string | null> {
  const base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
  if (base) return `${base}/${key}`;

  const s3 = getClient();
  if (!s3) return null;

  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
    { expiresIn: 3600 },
  );
}

export async function deleteObject(key: string): Promise<void> {
  const s3 = getClient();
  if (!s3) return;

  try {
    await s3.send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
    );
  } catch (error) {
    // The database row is the source of truth for the UI; a failed bucket
    // delete leaves an orphan object but must not fail the user's action.
    console.error("[storage] Could not delete object", key, error);
  }
}
