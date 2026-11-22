/**
 * Feature detection for optional infrastructure.
 *
 * Nothing here throws. Every integration in this app is optional except the
 * database, so the app can boot, build and render with an empty .env — missing
 * services surface as a clear disabled state in the UI rather than a crash.
 */

import { isCloudflareWorkers, getCloudflareBindings } from "@/lib/cloudflare";

export function isDatabaseConfigured(): boolean {
  // On Cloudflare Workers, Hyperdrive provides the connection string via binding
  if (isCloudflareWorkers()) {
    const bindings = getCloudflareBindings();
    const hyperdrive = bindings?.HYPERDRIVE as
      | { connectionString?: string }
      | undefined;
    if (hyperdrive?.connectionString) return true;
  }
  return Boolean(process.env.DATABASE_URL);
}

/** Server-side Firebase Admin credentials. */
export function isFirebaseAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
}

/** Browser Firebase SDK config. Safe to call on the client. */
export function isFirebaseClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

/**
 * Development sign-in without Firebase.
 *
 * Hard-disabled in production regardless of the env var — this is the guard
 * that keeps a convenience feature from becoming an authentication bypass.
 */
export function isDevAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  // Accept the public mirror too: the browser can only see NEXT_PUBLIC_*, and
  // requiring both variables to be set was an easy way to show a sign-in button
  // that the server then rejected.
  return (
    process.env.AUTH_DEV_MODE === "true" ||
    process.env.NEXT_PUBLIC_AUTH_DEV_MODE === "true"
  );
}

/** Client-visible mirror of {@link isDevAuthEnabled}. */
export function isDevAuthEnabledClient(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_AUTH_DEV_MODE === "true";
}

/**
 * S3-compatible object storage settings.
 *
 * Three naming schemes are supported:
 *
 * - The app's own `S3_*` variables, for Cloudflare R2 and AWS S3.
 * - The AWS-standard variables Neon Object Storage injects
 *   (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`,
 *   `AWS_REGION`), which `neon env pull` writes into `.env`.
 * - Cloudflare Workers R2 binding (`lms_core_uploads`), which is injected
 *   by Wrangler/OpenNext when the `r2_buckets` config is present.
 *
 * `S3_*` wins when both are present, so a deployment can point the app at a
 * different bucket than the one Neon manages. R2 binding is used automatically
 * when running on Cloudflare Workers with the binding configured.
 */
export type StorageConfig = {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

export function getStorageConfig(): StorageConfig | null {
  const accessKeyId =
    process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT ?? process.env.AWS_ENDPOINT_URL_S3;
  // Neon declares its buckets in `neon.ts`; `uploads` is the one this app
  // uses, so it is the sensible default when only Neon credentials are set.
  const bucket =
    process.env.S3_BUCKET ?? (process.env.AWS_ENDPOINT_URL_S3 ? "uploads" : "");
  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) return null;

  return {
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION ?? process.env.AWS_REGION ?? "auto",
  };
}

export function isStorageConfigured(): boolean {
  // Storage is configured if either S3 credentials are present OR
  // we're running on Cloudflare Workers with an R2 binding.
  if (getStorageConfig() !== null) return true;
  // Check for R2 binding (injected by Wrangler/OpenNext via Cloudflare context)
  if (typeof process !== "undefined") {
    // First check process.env (for local/dev where vars are strings)
    if (process.env.LMS_CORE_UPLOADS) return true;
    // Then check Cloudflare bindings (for deployed Workers where it's an object)
    if (isCloudflareWorkers()) {
      const bindings = getCloudflareBindings();
      if (bindings?.LMS_CORE_UPLOADS) return true;
    }
  }
  return false;
}

/**
 * Name of the configured storage provider, for the admin "This deployment"
 * card. Neon hands out the AWS-standard variables, so it is recognised by the
 * endpoint it injects rather than by an explicit opt-in.
 */
export function storageProviderLabel(): string {
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    return endpoint.includes("r2.cloudflarestorage.com")
      ? "Cloudflare R2"
      : "AWS S3";
  }
  if (process.env.AWS_ENDPOINT_URL_S3) return "Neon Object Storage";
  return "Object storage";
}

export function isRealtimeConfigured(): boolean {
  return Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.PUSHER_SECRET &&
      process.env.NEXT_PUBLIC_PUSHER_KEY,
  );
}

/** Client-visible mirror of {@link isRealtimeConfigured}. */
export function isRealtimeConfiguredClient(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY);
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_UPLOAD_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
] as const;
