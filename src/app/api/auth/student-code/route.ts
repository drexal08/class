import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminAuth } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { studentAuthEmail } from "@/lib/sdms/import-normalization";
import { getStorageConfig } from "@/lib/env";

const loginSchema = z.object({
  code: z.string().min(6).max(20),
  password: z.string().min(1),
});

function hashIp(ip: string): string {
  const secret = process.env.SDMS_SECRET ?? "dev-secret-change-me";
  let hash = 0;
  for (let i = 0; i < ip.length + secret.length; i++) {
    const ch = i < ip.length ? ip.charCodeAt(i) : secret.charCodeAt(i - ip.length);
    hash = (hash << 5) - hash + ch;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function checkRateLimit(codeHash: string, ipHash: string): { allowed: boolean; retryAfter?: number } {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000);

  // This would need a proper rate-limit table or Redis in production.
  // For now, implement a basic check using LoginAttempt.
  // We'll rely on the database unique index on recent attempts.
  return { allowed: true };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getAdminAuth();
  if (!admin) {
    return NextResponse.json(
      { error: "Authentication is not configured on this server. See SETUP.md." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your code and password" }, { status: 400 });
  }

  const { code, password } = parsed.data;
  const normalizedCode = code.trim().replace(/\s+/g, "").toUpperCase();
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  const codeHash = hashIp(normalizedCode);

  // Verify rate limits (simplified - in production use a dedicated table)
  // For now, we'll rely on Firebase's built-in rate limiting and the generic error.

  const domain = process.env.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN;
  if (!domain) {
    return NextResponse.json(
      { error: "Student email domain is not configured" },
      { status: 503 },
    );
  }

  const email = studentAuthEmail(normalizedCode, domain);

  try {
    const userRecord = await admin.getUserByEmail(email);
    const idToken = await admin.createCustomToken(userRecord.uid);

    // Use Firebase Identity Toolkit REST API for password verification
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Firebase API key not configured" },
        { status: 503 },
      );
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Log failed attempt
      await prisma.loginAttempt.create({
        data: { codeHash, ipHash, success: false },
      }).catch(() => {});

      // Generic error - no enumeration
      return NextResponse.json(
        { error: "Code or password is incorrect." },
        { status: 401 },
      );
    }

    // Log successful attempt
    await prisma.loginAttempt.create({
      data: { codeHash, ipHash, success: true },
    }).catch(() => {});

    // Now exchange the Firebase ID token for our session cookie
    // Reuse the existing signInWithFirebase logic
    const { signInWithFirebase } = await import("@/app/api/auth/session/route");
    return signInWithFirebase(data.idToken, undefined, { requiredStudentCode: normalizedCode });

  } catch (error) {
    // Generic error for any failure - no enumeration
    console.error("[student-code-login] Error:", error);
    return NextResponse.json(
      { error: "Code or password is incorrect." },
      { status: 401 },
    );
  }
}