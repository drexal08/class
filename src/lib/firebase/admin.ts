import "server-only";

import type { App, ServiceAccount } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";

import { isFirebaseAdminConfigured } from "@/lib/env";

const ADMIN_APP_NAME = "lms-core-admin";

/**
 * Lazily initialised Firebase Admin app.
 *
 * The SDK is pulled in with a dynamic import rather than a top-level one: a
 * static import loads the whole dependency chain on every request even when no
 * credentials are configured and none of these functions is ever called. Only
 * the types are imported statically, which erase at compile time.
 *
 * Returns `null` rather than throwing when credentials are absent, so that
 * `next build` succeeds with an empty .env and an unconfigured deployment
 * degrades to "signed out" instead of a 500.
 */
async function getAdminApp(): Promise<App | null> {
  if (!isFirebaseAdminConfigured()) return null;

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) return null;

  const { cert, getApp, getApps, initializeApp } = await import(
    "firebase-admin/app"
  );

  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return getApp(ADMIN_APP_NAME);

  return initializeApp({ credential: cert(serviceAccount) }, ADMIN_APP_NAME);
}

export async function getAdminAuth(): Promise<Auth | null> {
  const app = await getAdminApp();
  if (!app) return null;

  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(app);
}

/**
 * Accepts the service-account JSON either raw or base64-encoded — pasting raw
 * JSON into a hosting provider's env UI mangles newlines often enough that
 * supporting both is worth the six lines.
 */
function parseServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    const decoded = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");

    const parsed = JSON.parse(decoded) as {
      project_id?: string;
      projectId?: string;
      client_email?: string;
      clientEmail?: string;
      private_key?: string;
      privateKey?: string;
    };

    const projectId = parsed.project_id ?? parsed.projectId;
    const clientEmail = parsed.client_email ?? parsed.clientEmail;
    const privateKey = (parsed.private_key ?? parsed.privateKey)?.replace(
      /\\n/g,
      "\n",
    );

    if (!projectId || !clientEmail || !privateKey) {
      console.error(
        "[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id, client_email or private_key",
      );
      return null;
    }

    return { projectId, clientEmail, privateKey };
  } catch (error) {
    console.error(
      "[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON",
      error,
    );
    return null;
  }
}
