import "server-only";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

import { isFirebaseAdminConfigured } from "@/lib/env";

const ADMIN_APP_NAME = "lms-core-admin";

/**
 * Lazily initialised Firebase Admin app.
 *
 * Returns `null` rather than throwing when credentials are absent, so that
 * `next build` succeeds with an empty .env and an unconfigured deployment
 * degrades to "signed out" instead of a 500.
 */
function getAdminApp(): App | null {
  if (!isFirebaseAdminConfigured()) return null;

  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return getApp(ADMIN_APP_NAME);

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) return null;

  return initializeApp(
    { credential: cert(serviceAccount) },
    ADMIN_APP_NAME,
  );
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
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
