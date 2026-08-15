import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchX } from "lucide-react";

import { JoinConfirm } from "@/components/course/join-confirm";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCourseByCode } from "@/lib/data/courses";
import { accentClasses, cn, displayNameOf } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Join a class",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const course = await getCourseByCode(code);

  if (!course) {
    return (
      <div className="container-feed py-16">
        <EmptyState
          icon={SearchX}
          title="No class with that code"
          description="Check the code with your teacher — it is seven letters and numbers."
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to classes</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Already a member: skip the confirmation entirely.
  if (course.alreadyEnrolled) redirect(`/course/${course.id}`);

  return (
    <div className="container-feed py-16">
      <Card className="relative overflow-hidden p-8">
        <span
          className={cn(
            "absolute inset-x-0 top-0 h-1",
            accentClasses(course.accent).rule,
          )}
          aria-hidden
        />

        <p className="text-sm text-muted-foreground">You have been invited to</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {course.name}
        </h1>

        {(course.section || course.subject) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {[course.section, course.subject].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <UserAvatar user={course.teacher} className="size-9" />
          <div>
            <p className="text-sm font-medium">
              {displayNameOf(course.teacher)}
            </p>
            <p className="text-xs text-muted-foreground">
              {course._count.enrollments} already in this class
            </p>
          </div>
        </div>

        {course.archived ? (
          <p className="mt-8 rounded-md border border-warning/20 bg-warning-muted px-3 py-2.5 text-sm text-warning">
            This class has been archived, so it is not accepting new students.
          </p>
        ) : (
          <div className="mt-8">
            <JoinConfirm code={code.toUpperCase()} />
          </div>
        )}
      </Card>
    </div>
  );
}
