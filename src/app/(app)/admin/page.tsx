import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSchoolAdminOverview, listTeacherSchools } from "@/lib/data/school-admin";
import { SchoolAdminLayout } from "@/components/school/school-admin-layout";
import { JoinSchoolPrompt } from "@/components/school/join-school-prompt";

export const metadata: Metadata = { title: "School admin" };
export const dynamic = "force-dynamic";

interface TeacherSchool {
  role: string;
  school: {
    id: string;
    name: string;
    isLegacy: boolean;
  };
}

export default async function SchoolAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const { school: schoolId } = await searchParams;
  const teacherSchools = (await listTeacherSchools()) as TeacherSchool[];

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
    const membership = teacherSchools.find((s) => s.school.id === schoolId);
    if (!membership) notFound();
    if (membership.role !== "ADMIN") notFound(); // Only admins see the school admin console

    const overview = await getSchoolAdminOverview(schoolId);
    if (!overview) notFound();

    return (
      <SchoolAdminLayout
        school={{
          id: overview.id,
          name: overview.name,
          slug: overview.slug,
          isLegacy: overview.isLegacy,
          disabledAt: overview.disabledAt,
          joinCodes: overview.joinCodes,
          requiresApproval: overview.requiresApproval,
        }}
        cohorts={overview.cohorts}
        members={overview.members}
      />
    );
  }

  // Multiple schools - show selector
  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-semibold tracking-tight">School console</h1>
      <p className="mt-1 text-sm text-muted-foreground">Select a school to administer</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teacherSchools.map(({ school, role }) => (
          <a
            key={school.id}
            href={`/admin?school=${school.id}`}
            className="block rounded-lg border border-border p-5 hover:border-accent hover:bg-secondary/50 transition-colors"
          >
            <h3 className="font-semibold">{school.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Your role: {role}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
