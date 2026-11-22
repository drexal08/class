"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  promoteSchoolTeacherAction,
  reviewTeacherJoinAction,
} from "@/lib/actions/school-admin-actions";
import type { ActionState } from "@/lib/types";

export type SchoolTeacherView = {
  id: string;
  role: "ADMIN" | "TEACHER";
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
  name: string;
  email: string;
};

export function SchoolTeacherManager({
  schoolId,
  members,
}: {
  schoolId: string;
  members: SchoolTeacherView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: Promise<ActionState>, message: string) {
    startTransition(async () => {
      const result = await action;
      if (result.error) toast.error(result.error);
      else {
        toast.success(message);
        router.refresh();
      }
    });
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {members.length === 0 && <p className="p-5 text-sm text-muted-foreground">No staff members yet.</p>}
      {members.map((member) => (
        <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-medium">{member.name}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={member.status === "ACTIVE" ? "secondary" : "outline"}>{member.status}</Badge>
            <Badge variant="outline">{member.role}</Badge>
            {member.status === "PENDING" && (
              <>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => run(reviewTeacherJoinAction(schoolId, member.id, "ACTIVE"), "Teacher approved")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(reviewTeacherJoinAction(schoolId, member.id, "REJECTED"), "Request rejected")}
                >
                  Reject
                </Button>
              </>
            )}
            {member.status === "ACTIVE" && member.role === "TEACHER" && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(promoteSchoolTeacherAction(schoolId, member.id), "School admin promoted")}
              >
                Make admin
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
