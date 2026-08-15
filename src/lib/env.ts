/**
 * Feature detection for optional infrastructure.
 *
 * Nothing here throws. Every integration in this app is optional except the
 * database, so the app can boot, build and render with an empty .env — missing
 * services surface as a clear disabled state in the UI rather than a crash.
 */

export function isDatabaseConfigured(): boolean {
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
  return process.env.AUTH_DEV_MODE === "true";
}

/** Client-visible mirror of {@link isDevAuthEnabled}. */
export function isDevAuthEnabledClient(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_AUTH_DEV_MODE === "true";
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_ENDPOINT,
  );
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
