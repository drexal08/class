"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Shield, Lock, Users, Bell } from "lucide-react";
import { updateSchoolSettingsActionSimple } from "@/lib/actions/school-admin-actions";
import type { ActionState } from "@/lib/types";

interface SchoolSettingsProps {
  schoolId: string;
  initialSettings: {
    name: string;
    slug: string;
    isLegacy: boolean;
    disabledAt: Date | null;
    requiresApproval: boolean;
  };
}

export function SchoolSettings({ schoolId, initialSettings }: SchoolSettingsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialSettings.name);
  const [requiresApproval, setRequiresApproval] = useState(initialSettings.requiresApproval);

  async function handleUpdateSettings() {
    startTransition(async () => {
      try {
        const result = await updateSchoolSettingsActionSimple(schoolId, name, requiresApproval);
        if (result.error) throw new Error(result.error);
        toast.success("School settings updated");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update settings");
      }
    });
  }

  async function handleDisableSchool() {
    if (!confirm("Disable this school? All members will lose access until re-enabled.")) return;
    startTransition(async () => {
      try {
        // This would need a new action - for now just toast
        toast.error("Not implemented yet");
      } catch (error) {
        toast.error("Failed to disable school");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          School settings
        </CardTitle>
        <CardDescription>
          Configure school-wide settings. These affect all members and cohorts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-4">
          <h3 className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            General
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school-name">School name</Label>
              <Input
                id="school-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Require approval for new staff</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, teachers must be approved by an admin before accessing the school console.
                </p>
              </div>
              <Switch
                checked={requiresApproval}
                onCheckedChange={setRequiresApproval}
                disabled={pending}
              />
            </div>
          </div>
          <Button onClick={handleUpdateSettings} disabled={pending}>
            {pending ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin" /> Saving...</span> : "Save changes"}
          </Button>
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff management
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage staff roles and permissions in the Staff section above.
          </p>
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Access control
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Disable this school to prevent all members from accessing it. This does not delete data.
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Disable school</p>
              <p className="text-sm text-muted-foreground">
                All members will lose access. Data is preserved.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleDisableSchool}
              disabled={true}
            >
              Disable school
            </Button>
          </div>
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </h3>
          <p className="text-sm text-muted-foreground">
            Notification settings are managed globally in your account settings.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}