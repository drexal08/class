import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlatformConsole } from "@/components/school/platform-console";
import { getCurrentUser } from "@/lib/auth/session";
import { listPlatformSchools } from "@/lib/data/school-admin";

export const metadata: Metadata = { title: "Platform console" };
export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const user = await getCurrentUser();
  if (!user || user.platformRole !== "SUPERUSER") notFound();

  const schools = await listPlatformSchools();

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Platform console</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        School tenancy and platform structure. Counts only; student data is not shown here.
      </p>
      <PlatformConsole schools={schools} />
    </div>
  );
}