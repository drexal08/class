import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { requireSuperuser } from "@/lib/sdms/access";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "School detail" };
export const dynamic = "force-dynamic";

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.platformRole !== "SUPERUSER") notFound();

  const { id } = await params;
  await requireSuperuser();

  const school = await prisma.school.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      isLegacy: true,
      disabledAt: true,
      requiresApproval: true,
      createdAt: true,
      createdById: true,
      joinCodes: { where: { kind: "SCHOOL" }, select: { code: true }, take: 1 },
      members: {
        orderBy: [{ status: "asc" }, { requestedAt: "asc" }],
        select: {
          id: true,
          role: true,
          status: true,
          requestedAt: true,
          decidedAt: true,
          user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        },
      },
      cohorts: {
        where: { archivedAt: null },
        orderBy: [{ combination: { stream: "asc" } }, { label: "asc" }],
        select: {
          id: true,
          label: true,
          grade: true,
          academicYear: true,
          combination: { select: { name: true, shortName: true, stream: true } },
          _count: { select: { members: true, courses: true } },
          joinCodes: { where: { kind: "COHORT" }, select: { code: true }, take: 1 },
        },
      },
      _count: { select: { members: true, cohorts: true, courses: true } },
    },
  });

  if (!school) notFound();

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{school.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {school.isLegacy ? "Legacy school · " : ""}School code:{' '}
            <code className="font-mono">{school.joinCodes[0]?.code ?? "—"}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={school.disabledAt ? "danger" : "success"}>
            {school.disabledAt ? "Disabled" : "Active"}
          </Badge>
          <Badge variant={school.isLegacy ? "secondary" : "outline"}>
            {school.isLegacy ? "Legacy" : "Standard"}
          </Badge>
          <a href={`/admin?school=${school.id}`} className="text-sm text-accent hover:underline">
            Open in School Admin
          </a>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Staff ({school.members.length})</h2>
            <p className="text-sm text-muted-foreground">Pending requests require approval. Active teachers can be promoted to admin.</p>
          </div>
          <SchoolTeacherManager schoolId={school.id} members={school.members} />
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-4">Cohorts ({school.cohorts.length})</h2>
          <div className="divide-y divide-border">
            {school.cohorts.map((cohort: { id: string; label: string; grade: string; academicYear: number; combination: { name: string }; _count: { members: number; courses: number }; joinCodes: Array<{ code: string }> }) => (
              <div key={cohort.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{cohort.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {cohort.grade} · {cohort.combination.name} · {cohort.academicYear}/{cohort.academicYear + 1}
                    · {cohort._count.members} students · {cohort._count.courses} courses
                  </p>
                </div>
                <div className="flex gap-2">
                  <code className="rounded bg-secondary px-2 py-1 font-mono text-sm">
                    {cohort.joinCodes[0]?.code ?? "—"}
                  </code>
                  <a href={`/admin/cohort/${cohort.id}`} className="text-sm text-accent hover:underline">
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-4">Courses ({school._count.courses})</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(await prisma.course.findMany({
              where: { schoolId: school.id },
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                subject: true,
                kind: true,
                teacherId: true,
                _count: { select: { enrollments: true } },
              },
            })).map((course: { id: string; name: string; subject: string | null; kind: string; _count: { enrollments: number } }) => (
              <Card key={course.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{course.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {course.kind === "HOMEROOM" ? "Homeroom" : course.subject ?? "Subject"}
                    </p>
                  </div>
                  <Badge variant="outline">{course.kind}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-4">Audit Events (Recent)</h2>
          <AuditEventList schoolId={school.id} />
        </section>
      </div>
    </div>
  );
}

import { SchoolTeacherManager } from "@/components/school/school-teacher-manager";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function AuditEventList({ schoolId }: { schoolId: string }) {
  const events = await prisma.auditEvent.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      actorId: true,
      createdAt: true,
      metadata: true,
    },
  });

  if (events.length === 0) {
    return <p className="text-muted-foreground">No audit events for this school.</p>;
  }

  return (
    <div className="space-y-2">
      {events.map((event: { id: string; action: string; targetType: string; targetId: string | null; actorId: string; createdAt: Date }) => (
        <div key={event.id} className="p-3 rounded-lg bg-secondary flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{event.action}</p>
            <p className="text-sm text-muted-foreground">
              {event.targetType} {event.targetId ?? ""} · {event.createdAt.toLocaleString()}
            </p>
          </div>
          <Badge variant="outline">{event.actorId.slice(0, 8)}</Badge>
        </div>
      ))}
    </div>
  );
}