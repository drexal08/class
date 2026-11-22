import type { Metadata } from "next";

import { JoinSchoolForm } from "@/components/school/join-school-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Join a school" };
export const dynamic = "force-dynamic";

export default async function JoinSchoolPage() {
  const user = await getCurrentUser({ allowUnclaimed: true });
  if (!user) return <div className="container-page py-8">Redirecting…</div>;
  if (user.role === "STUDENT") {
    return (
      <div className="container-page py-8">
        <p className="text-muted-foreground">Students join their cohort, not a school staff team.</p>
      </div>
    );
  }

  return (
    <div className="container-page py-8 max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Join a school</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the school code provided by the school admin. They must approve your request before you can access the school console.
      </p>
      <JoinSchoolForm />
    </div>
  );
}