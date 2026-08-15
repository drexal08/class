"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type UserCredential,
} from "firebase/auth";

import { isFirebaseClientConfigured } from "@/lib/env";

/**
 * Firebase is initialised lazily, never at module scope.
 *
 * `/login` and `/register` are statically prerendered during `next build`. A
 * top-level `initializeApp()` would run with no config at build time and throw,
 * so every entry point below goes through {@link getFirebaseAuth}, which
 * returns `null` when the project isn't configured.
 */
function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseClientConfigured()) return null;
  if (getApps().length > 0) return getApp();

  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  });
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  const auth = requireAuth();
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<UserCredential> {
  const auth = requireAuth();
  await setPersistence(auth, browserLocalPersistence);

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  return credential;
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const auth = requireAuth();
  await setPersistence(auth, browserLocalPersistence);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

/** Clears the Firebase client session; the server cookie is cleared separately. */
export async function signOutClient(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) await signOut(auth);
}

function requireAuth(): Auth {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error(
      "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* values to .env, or set AUTH_DEV_MODE=true to sign in without Firebase.",
    );
  }
  return auth;
}

/** Maps Firebase error codes to messages a student or teacher can act on. */
export function firebaseErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password";
    case "auth/email-already-in-use":
      return "An account with this email already exists";
    case "auth/weak-password":
      return "Choose a stronger password (at least 8 characters)";
    case "auth/invalid-email":
      return "Enter a valid email address";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups and retry";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled for this Firebase project";
    case "auth/unauthorized-domain":
      return "This domain is not authorised in your Firebase project settings";
    default:
      return error instanceof Error
        ? error.message
        : "Something went wrong. Please try again";
  }
}
