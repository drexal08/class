import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Search } from "lucide-react";

import { SchoolTeacherManager } from "@/components/school/school-teacher-manager";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth/session";
import { getSchoolAdminOverview, listTeacherSchools } from "@/lib/data/school-admin";

export const metadata: Metadata = { title: "School admin" };
export const dynamic = "force-dynamic";

export default async function SchoolAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const { school: schoolId } = await searchParams;
  const teacherSchools = await listTeacherSchools();

  // If user has no school memberships, show join prompt
  if (teacherSchools.length === 0) {
    return (
      <div className="container-page py-8">
        <h1 className="text-2xl font-semibold tracking-tight">School console</h1>
        <p className="mt-1 text-sm text-muted-foreground">You are not a member of any school.</p>
        <div className="mt-6">
          <JoinSchoolPrompt />
        </div>
      </div>
    );
  }

  // If no school selected and user has exactly one, redirect to it
  if (!schoolId && teacherSchools.length === 1) {
    redirect(`/admin?school=${teacherSchools[0].school.id}`);
  }

  // If schoolId provided, verify membership
    if (schoolId) {
      const membership = teacherSchools.find((s: { school: { id: string } }) => s.school.id === schoolId);
    if (!membership) notFound();
    if (membership.role !== "ADMIN") notFound(); // Only admins see the school admin console
    return <SchoolAdminView schoolId={schoolId} />;
  }

  // Multiple schools - show selector
    return (
      <div className="container-page py-8">
        <h1 className="text-2xl font-semibold tracking-tight">School console</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select a school to administer</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teacherSchools.map(({ school, role }: { school: { id: string; name: string }; role: string }) => (
            <Card
              key={school.id}
              className="cursor-pointer hover:border-accent transition-colors"
              onClick={() => window.location.assign(`/admin?school=${school.id}`)}
            >
              <div className="p-5">
                <h3 className="font-semibold">{school.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Your role: {role}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  async function SchoolAdminView({ schoolId }: { schoolId: string }) {
  const overview = await getSchoolAdminOverview(schoolId);
  if (!overview) notFound();

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{overview.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {overview.isLegacy ? "Legacy school · " : ""}School code:{" "}
            <code className="font-mono">{overview.joinCodes[0]?.code ?? "—"}</code>
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Staff</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pending requests require approval. Active teachers can be promoted to admin.
          </p>
          <SchoolTeacherManager schoolId={schoolId} members={overview.members} />
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Cohorts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {overview.cohorts.length} cohort{overview.cohorts.length !== 1 ? "s" : ""} in this school.
          </p>
          <div className="mt-4 divide-y divide-border">
            {overview.cohorts.map((cohort: {
              id: string;
              label: string;
              grade: string;
              combination: { name: string };
              academicYear: number;
              _count: { members: number; courses: number };
              joinCodes: Array<{ code: string }>;
            }) => (
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
                  <a
                    href={`/admin/cohort/${cohort.id}`}
                    className="text-sm text-accent hover:underline"
                  >
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function JoinSchoolPrompt() {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-muted-foreground">You are not a member of any school.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask your school admin for the school code, then request to join.
      </p>
      <div className="mt-4">
        <a href="/join-school" className="text-accent hover:underline">
          Join a school →
        </a>
      </div>
    </div>
  );
}
