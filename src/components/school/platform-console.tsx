"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  appointSchoolAdminAction,
  createSchoolAction,
  setSchoolDisabledAction,
} from "@/lib/actions/school-admin-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

export type PlatformSchoolView = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  admins: string[];
  teacherCount: number;
  cohortCount: number;
  courseCount: number;
  studentCount: number;
  disabled: boolean;
  isLegacy: boolean;
};

export function PlatformConsole({ schools }: { schools: PlatformSchoolView[] }) {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader><CardTitle>Create a school</CardTitle></CardHeader>
        <CardContent><CreateSchoolForm /></CardContent>
      </Card>
      <div className="space-y-4">
        {schools.map((school) => <SchoolRow key={school.id} school={school} />)}
      </div>
    </div>
  );
}

function CreateSchoolForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await createSchoolAction(previous, formData);
      if (result.success) router.refresh();
      return result;
    },
    EMPTY_ACTION_STATE,
  );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="school-name">School name</Label>
        <Input id="school-name" name="name" required maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-email">Admin email (optional)</Label>
        <Input id="admin-email" name="adminEmail" type="email" />
      </div>
      <div className="sm:col-span-2"><FormError message={state.error} /></div>
      <Button className="w-fit" disabled={pending}>{pending ? "Creating…" : "Create school"}</Button>
    </form>
  );
}

function SchoolRow({ school }: { school: PlatformSchoolView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");

  function run(action: Promise<ActionState>, success: string) {
    startTransition(async () => {
      const result = await action;
      if (result.error) toast.error(result.error);
      else {
        toast.success(success);
        router.refresh();
      }
    });
  }

  return (
    <Card className={school.disabled ? "opacity-70" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{school.name}{school.isLegacy ? " (Legacy)" : ""}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {school.teacherCount} staff · {school.cohortCount} cohorts · {school.courseCount} courses · {school.studentCount} cohort members
            </p>
          </div>
          <code className="rounded bg-secondary px-2 py-1 font-mono text-sm">{school.code ?? "No code"}</code>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Admins: {school.admins.join(", ") || "Not appointed"}</p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teacher@example.com"
            type="email"
            className="max-w-xs"
            aria-label={`New admin email for ${school.name}`}
          />
          <Button
            variant="outline"
            disabled={pending || !email}
            onClick={() => run(appointSchoolAdminAction(school.id, email), "School admin appointed")}
          >
            Appoint admin
          </Button>
          <Button
            variant={school.disabled ? "outline" : "destructive"}
            disabled={pending}
            onClick={() => run(setSchoolDisabledAction(school.id, !school.disabled), school.disabled ? "School enabled" : "School disabled")}
          >
            {school.disabled ? "Enable school" : "Disable school"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
