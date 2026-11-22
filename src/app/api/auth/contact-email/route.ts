import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { emailSchema } from "@/lib/validators";

const contactEmailSchema = z.object({
  email: emailSchema.nullable(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser({ allowUnclaimed: true });
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = contactEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email" }, { status: 400 });
  }

  const { email } = parsed.data;

  await prisma.user.update({
    where: { id: user.id },
    data: { contactEmail: email ?? null },
  });

  return NextResponse.json({ ok: true });
}