import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/settings/profile-form";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import {
  isFirebaseAdminConfigured,
  isRealtimeConfigured,
  isStorageConfigured,
} from "@/lib/env";
import { ROLE_LABELS } from "@/lib/types";
import { displayNameOf } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="container-feed py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="mt-6 space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <UserAvatar user={user} className="size-14" />
            <div className="min-w-0">
              <p className="truncate text-lg font-medium">
                {displayNameOf(user)}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {user.email}
              </p>
              <Badge variant="outline" className="mt-2">
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Your email and role are managed by your institution. Ask an
            administrator if either needs to change.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="font-medium">Your name</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This is how you appear to classmates and teachers.
          </p>
          <ProfileForm displayName={user.displayName ?? ""} />
        </Card>

        <Card className="p-6">
          <h2 className="font-medium">This deployment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional integrations and whether they are configured.
          </p>

          <dl className="mt-4 space-y-2 text-sm">
            <ServiceRow
              label="Authentication (Firebase)"
              ready={isFirebaseAdminConfigured()}
              fallback="Development sign-in"
            />
            <ServiceRow
              label="File uploads (R2 / S3)"
              ready={isStorageConfigured()}
              fallback="Disabled"
            />
            <ServiceRow
              label="Live updates (Pusher)"
              ready={isRealtimeConfigured()}
              fallback="Polling"
            />
          </dl>
        </Card>
      </div>
    </div>
  );
}

function ServiceRow({
  label,
  ready,
  fallback,
}: {
  label: string;
  ready: boolean;
  fallback: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <Badge variant={ready ? "success" : "outline"}>
          {ready ? "Configured" : fallback}
        </Badge>
      </dd>
    </div>
  );
}
