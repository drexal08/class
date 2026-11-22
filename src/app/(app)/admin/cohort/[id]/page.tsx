import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CohortImport } from "@/components/cohort/cohort-import";
import { CombinationManager } from "@/components/school/combination-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth/session";
import { getCohortRoster, exportClaimStatusCsv } from "@/lib/data/school-admin";
import { requireCohortManager } from "@/lib/sdms/access";

export const metadata: Metadata = { title: "Cohort detail" };
export const dynamic = "force-dynamic";

export default async function CohortDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, cohort: cohortData } = await requireCohortManager(id);
  const cohort = await getCohortRoster(id);
  if (!cohort) notFound();

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{cohort.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cohort.grade} · {cohort.combination.name} · {cohort.academicYear}/{cohort.academicYear + 1}
            · {cohort.school.name}
          </p>
        </div>
        <div className="flex gap-2">
          <code className="rounded bg-secondary px-2 py-1 font-mono text-sm">
            {cohort.joinCodes[0]?.code ?? "—"}
          </code>
          <a
            href={`/api/admin/cohort/${cohort.id}/claim-status.csv`}
            className="text-sm text-accent hover:underline"
          >
            Export claim status CSV
          </a>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <CohortImport cohortId={cohort.id} />
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <CardTitle>Roster ({cohort.members.length})</CardTitle>
            <div className="flex gap-2">
              <Badge variant={cohort.members.some((m: { status: string }) => m.status !== "ACTIVE") ? "secondary" : "outline"}>
                Show all
              </Badge>
            </div>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">Code</th>
                  <th className="text-left p-3 text-sm font-medium">Name</th>
                  <th className="text-left p-3 text-sm font-medium">Gender</th>
                  <th className="text-left p-3 text-sm font-medium">Claimed</th>
                  <th className="text-left p-3 text-sm font-medium">Last sign-in</th>
                  <th className="text-left p-3 text-sm font-medium">Status</th>
                  <th className="text-left p-3 text-sm font-medium">Dispute</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cohort.members.map((member: {
                  id: string;
                  status: string;
                  claimedAt: Date | null;
                  lastSignInAt: Date | null;
                  user: { studentCode: string | null; displayName: string | null; gender: string | null };
                  disputes: Array<{ id: string }>;
                }) => (
                  <tr key={member.id}>
                    <td className="p-3 text-sm font-mono">{member.user.studentCode ?? "—"}</td>
                    <td className="p-3 text-sm">{member.user.displayName ?? "—"}</td>
                    <td className="p-3 text-sm">{member.user.gender ?? "—"}</td>
                    <td className="p-3 text-sm">
                      {member.claimedAt
                        ? member.claimedAt.toLocaleString()
                        : <span className="text-muted-foreground">Not claimed</span>}
                    </td>
                    <td className="p-3 text-sm">
                      {member.lastSignInAt
                        ? member.lastSignInAt.toLocaleString()
                        : <span className="text-muted-foreground">Never</span>}
                    </td>
                    <td className="p-3 text-sm">
                      <Badge variant={member.status === "ACTIVE" ? "default" : "outline"}>
                        {member.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm">
                      {member.disputes.length > 0 ? (
                        <Badge variant="danger">Disputed</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <CombinationManager schoolId={cohort.schoolId} />
        </section>

        <section>
          <CardTitle className="mb-4">Courses</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cohort.courses.map((course: {
                  id: string;
                  name: string;
                  subject: string | null;
                  kind: string;
                }) => (
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
      </div>
    </div>
  );
}