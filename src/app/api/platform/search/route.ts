import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSuperuser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

const searchSchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(["all", "schools", "users", "cohorts", "courses"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireSuperuser();

  const { searchParams } = new URL(request.url);
  const parsed = searchSchema.safeParse({
    q: searchParams.get("q"),
    type: searchParams.get("type"),
    limit: searchParams.get("limit"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const { q, type, limit } = parsed.data;
  const query = `%${q}%`;

  const results: Record<string, unknown[]> = {};

  if (type === "all" || type === "schools") {
    results.schools = await prisma.school.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        isLegacy: true,
        disabledAt: true,
        joinCodes: { where: { kind: "SCHOOL" }, select: { code: true }, take: 1 },
      },
    });
  }

  if (type === "all" || type === "users") {
    results.users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
          { studentCode: { contains: q, mode: "insensitive" } },
        ],
        archivedAt: null,
      },
      take: limit,
      select: {
        id: true,
        email: true,
        displayName: true,
        studentCode: true,
        role: true,
        platformRole: true,
        authKind: true,
        createdAt: true,
        _count: { select: { enrollments: true, createdCourses: true } },
      },
    });
  }

  if (type === "all" || type === "cohorts") {
    results.cohorts = await prisma.cohort.findMany({
      where: {
        OR: [
          { label: { contains: q, mode: "insensitive" } },
          { grade: { contains: q, mode: "insensitive" } },
        ],
        archivedAt: null,
      },
      take: limit,
      select: {
        id: true,
        label: true,
        grade: true,
        academicYear: true,
        school: { select: { id: true, name: true } },
        combination: { select: { name: true } },
        _count: { select: { members: true } },
      },
    });
  }

  if (type === "all" || type === "courses") {
    results.courses = await prisma.course.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { subject: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      select: {
        id: true,
        name: true,
        code: true,
        subject: true,
        kind: true,
        school: { select: { id: true, name: true } },
        cohort: { select: { id: true, label: true } },
        teacher: { select: { displayName: true, email: true } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  return NextResponse.json(results);
}