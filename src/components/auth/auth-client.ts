"use client";

import {
  firebaseErrorMessage,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/firebase/client";
import type { ActionState } from "@/lib/types";

type Role = "TEACHER" | "STUDENT";

/**
 * Trades a Firebase ID token for the httpOnly session cookie and syncs the user
 * row (PRD Module A). Returns an `ActionState` so the forms keep the same
 * `useActionState` contract as the rest of the app.
 */
async function exchange(body: Record<string, unknown>): Promise<ActionState> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return { error: data.error ?? "Could not sign you in" };
  }

  return { success: true };
}

/** A full navigation, so the first server render already sees the new cookie. */
function goTo(next: string | null | undefined) {
  window.location.assign(next && next.startsWith("/") ? next : "/dashboard");
}

export async function signInAction(
  next: string | null,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password" };
  }

  try {
    const credential = await signInWithEmail(email, password);
    const result = await exchange({
      idToken: await credential.user.getIdToken(),
    });
    if (result.error) return result;

    goTo(next);
    return { success: true };
  } catch (error) {
    return { error: firebaseErrorMessage(error) };
  }
}

export async function signUpAction(
  next: string | null,
  formData: FormData,
): Promise<ActionState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = (String(formData.get("role") ?? "STUDENT") as Role) ?? "STUDENT";

  if (displayName.length < 2) return { error: "Enter your full name" };
  if (!email) return { error: "Enter your email address" };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  try {
    const credential = await signUpWithEmail(email, password, displayName);
    const result = await exchange({
      idToken: await credential.user.getIdToken(),
      intendedRole: role,
    });
    if (result.error) return result;

    goTo(next);
    return { success: true };
  } catch (error) {
    return { error: firebaseErrorMessage(error) };
  }
}

export async function googleAction(
  next: string | null,
  role?: Role,
): Promise<ActionState> {
  try {
    const credential = await signInWithGoogle();
    const result = await exchange({
      idToken: await credential.user.getIdToken(),
      intendedRole: role,
    });
    if (result.error) return result;

    goTo(next);
    return { success: true };
  } catch (error) {
    return { error: firebaseErrorMessage(error) };
  }
}

/** Development sign-in: no Firebase project required. */
export async function devSignInAction(
  next: string | null,
  formData: FormData,
): Promise<ActionState> {
  const devEmail = String(formData.get("email") ?? "").trim();
  const devName = String(formData.get("displayName") ?? "").trim();
  const role = String(formData.get("role") ?? "STUDENT") as Role;

  if (!devEmail) return { error: "Enter an email address" };

  const result = await exchange({
    devEmail,
    devName: devName || undefined,
    intendedRole: role,
  });
  if (result.error) return result;

  goTo(next);
  return { success: true };
}
