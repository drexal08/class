import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";

import { UserDirectory } from "@/components/admin/user-directory";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth/session";
import { getInstitutionStats, listAllUsers } from "@/lib/data/courses";

export const metadata: Metadata = { title: "Admin console" };
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  // A non-admin gets a 404 rather than a "forbidden" that confirms the page.
  if (!user || user.role !== "ADMIN") notFound();

  const { q } = await searchParams;
  const [stats, users] = await Promise.all([
    getInstitutionStats(),
    listAllUsers(q),
  ]);

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin console</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Institution-wide directory and configuration.
      </p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="People" value={stats.users} />
        <Stat label="Active classes" value={stats.courses} />
        <Stat label="Classwork items" value={stats.assignments} />
        <Stat label="Graded submissions" value={stats.graded} />
      </dl>

      <div className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Directory</h2>

          <form className="relative">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
            <Input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search name or email"
              className="w-64 pl-9"
              aria-label="Search users"
            />
          </form>
        </div>

        <div className="mt-4">
          <UserDirectory users={users} viewerId={user.id} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </Card>
  );
}
