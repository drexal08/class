"use client";

import {
  firebaseErrorMessage,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/firebase/client";

type Role = "TEACHER" | "STUDENT";

/**
 * The outcome of an authentication attempt.
 *
 * `needs-role` is the interesting one: the account is new, so the server
 * refuses to create it until the person says whether they are teaching or
 * learning. The `retry` closure carries the credentials for that second
 * exchange, so the token never has to be held in React state.
 */
export type AuthOutcome =
  | { status: "signed-in" }
  | {
      status: "needs-role";
      email: string | null;
      displayName: string | null;
      retry: (role: Role) => Promise<AuthOutcome>;
    }
  | { status: "error"; error: string };

type ExchangeResult =
  | { status: "signed-in" }
  | {
      status: "needs-role";
      email: string | null;
      displayName: string | null;
    }
  | { status: "error"; error: string };

/**
 * Trades a Firebase ID token for the httpOnly session cookie and syncs the user
 * row (PRD Module A).
 */
async function exchange(
  body: Record<string, unknown>,
): Promise<ExchangeResult> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    needsRole?: boolean;
    email?: string | null;
    displayName?: string | null;
  };

  // 409 means "new account, tell me the role first".
  if (response.status === 409 && data.needsRole) {
    return {
      status: "needs-role",
      email: data.email ?? null,
      displayName: data.displayName ?? null,
    };
  }

  if (!response.ok) {
    return { status: "error", error: data.error ?? "Could not sign you in" };
  }

  return { status: "signed-in" };
}

/** A full navigation, so the first server render already sees the new cookie. */
export function goTo(next: string | null | undefined) {
  window.location.assign(next && next.startsWith("/") ? next : "/dashboard");
}

/**
 * A retry can only succeed or fail: the account exists by the time the role is
 * sent, so the server never asks a second time.
 */
function asOutcome(result: ExchangeResult): AuthOutcome {
  if (result.status === "needs-role") {
    return {
      status: "error",
      error: "Could not finish signing in. Please try again.",
    };
  }
  return result;
}

export async function signInAction(formData: FormData): Promise<AuthOutcome> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { status: "error", error: "Enter your email and password" };
  }

  try {
    const credential = await signInWithEmail(email, password);
    const idToken = await credential.user.getIdToken();
    const result = await exchange({ idToken });

    if (result.status === "needs-role") {
      return {
        ...result,
        retry: async (role) =>
          asOutcome(
            await exchange({
              idToken: await credential.user.getIdToken(true),
              intendedRole: role,
            }),
          ),
      };
    }

    return result;
  } catch (error) {
    return { status: "error", error: firebaseErrorMessage(error) };
  }
}

export async function signUpAction(formData: FormData): Promise<AuthOutcome> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as Role;

  if (displayName.length < 2) {
    return { status: "error", error: "Enter your full name" };
  }
  if (!email) return { status: "error", error: "Enter your email address" };
  if (password.length < 8) {
    return { status: "error", error: "Password must be at least 8 characters" };
  }
  if (role !== "TEACHER" && role !== "STUDENT") {
    return { status: "error", error: "Choose whether you are a teacher or a student" };
  }

  try {
    const credential = await signUpWithEmail(email, password, displayName);
    const idToken = await credential.user.getIdToken();
    const result = await exchange({ idToken, intendedRole: role });

    if (result.status === "needs-role") {
      return {
        ...result,
        retry: async (chosen) =>
          asOutcome(
            await exchange({
              idToken: await credential.user.getIdToken(true),
              intendedRole: chosen,
            }),
          ),
      };
    }

    return result;
  } catch (error) {
    return { status: "error", error: firebaseErrorMessage(error) };
  }
}

/**
 * Google sign-in.
 *
 * The role is optional here on purpose: the server only knows whether the
 * account is new once the token is verified, and only new accounts are asked
 * the question. Returning users are never interrupted.
 */
export async function googleAction(role?: Role): Promise<AuthOutcome> {
  try {
    const credential = await signInWithGoogle();
    const idToken = await credential.user.getIdToken();
    const result = await exchange({
      idToken,
      ...(role ? { intendedRole: role } : {}),
    });

    if (result.status === "needs-role") {
      return {
        ...result,
        retry: async (chosen) =>
          asOutcome(
            await exchange({
              idToken: await credential.user.getIdToken(true),
              intendedRole: chosen,
            }),
          ),
      };
    }

    return result;
  } catch (error) {
    return { status: "error", error: firebaseErrorMessage(error) };
  }
}

/** Development sign-in: no Firebase project required. */
export async function devSignInAction(formData: FormData): Promise<AuthOutcome> {
  const devEmail = String(formData.get("email") ?? "").trim();
  const devName = String(formData.get("displayName") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  const intendedRole = role === "TEACHER" || role === "STUDENT" ? role : undefined;

  if (!devEmail) return { status: "error", error: "Enter an email address" };

  const body: Record<string, unknown> = {
    devEmail,
    devName: devName || undefined,
    ...(intendedRole ? { intendedRole } : {}),
  };

  const result = await exchange(body);

  if (result.status === "needs-role") {
    return {
      ...result,
      retry: async (chosen) =>
        asOutcome(await exchange({ ...body, intendedRole: chosen })),
    };
  }

  return result;
}
