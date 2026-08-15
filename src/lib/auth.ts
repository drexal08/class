import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Simple token-based session using signed cookies
const SESSION_COOKIE = "gc_session";
const SECRET = process.env.SESSION_SECRET || "google-classroom-clone-secret-key-2024";

function signToken(userId: number): string {
  const payload = JSON.stringify({ userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const hmac = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(payload).toString("base64") + "." + hmac;
}

function verifyToken(token: string): { userId: number } | null {
  try {
    const [payloadB64, hmac] = token.split(".");
    if (!payloadB64 || !hmac) return null;
    const payload = Buffer.from(payloadB64, "base64").toString();
    const expectedHmac = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    if (hmac !== expectedHmac) return null;
    const data = JSON.parse(payload);
    if (data.exp < Date.now()) return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}

export async function createSession(userId: number): Promise<void> {
  const token = signToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "teacher" | "student";
  avatarColor: string;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload) return null;
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        avatarColor: users.avatarColor,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
