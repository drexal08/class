"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Users, Building2, AlertTriangle, Database, Logs, Settings, Download, Upload, Eye, Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { GlobalSearch } from "@/components/platform/global-search";
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
  const [activeTab, setActiveTab] = useState<"overview" | "schools" | "analytics" | "audit" | "migration" | "search" | "settings">("overview");
  const handleTabChange = (value: "overview" | "schools" | "analytics" | "audit" | "migration" | "search" | "settings") => setActiveTab(value);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSchools = schools.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.code?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const stats = {
    totalSchools: schools.length,
    activeSchools: schools.filter(s => !s.disabled).length,
    legacySchools: schools.filter(s => s.isLegacy).length,
    totalStudents: schools.reduce((sum, s) => sum + s.studentCount, 0),
    totalTeachers: schools.reduce((sum, s) => sum + s.teacherCount, 0),
    totalCohorts: schools.reduce((sum, s) => sum + s.cohortCount, 0),
    totalCourses: schools.reduce((sum, s) => sum + s.courseCount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Schools" value={stats.totalSchools} icon={<Building2 className="h-5 w-5" />} />
        <StatCard title="Active Schools" value={stats.activeSchools} icon={<Activity className="h-5 w-5" />} />
        <StatCard title="Total Students" value={stats.totalStudents} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Total Staff" value={stats.totalTeachers} icon={<Users className="h-5 w-5" />} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange as (value: string) => void} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview"><Building2 className="mr-2 h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="schools"><Building2 className="mr-2 h-4 w-4" /> Schools</TabsTrigger>
          <TabsTrigger value="analytics"><Activity className="mr-2 h-4 w-4" /> Analytics</TabsTrigger>
          <TabsTrigger value="audit"><Logs className="mr-2 h-4 w-4" /> Audit Log</TabsTrigger>
          <TabsTrigger value="migration"><Database className="mr-2 h-4 w-4" /> Migration</TabsTrigger>
          <TabsTrigger value="search"><Search className="mr-2 h-4 w-4" /> Search</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" /> Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Platform Overview</CardTitle>
              <CardDescription>System-wide statistics and quick actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <QuickActionCard title="Create School" description="Add a new school to the platform" icon={<Plus className="h-5 w-5" />} action={<CreateSchoolForm />} />
                <QuickActionCard title="View Audit Log" description="Review system-wide audit events" icon={<Logs className="h-5 w-5" />} href="/platform/audit" />
                <QuickActionCard title="Migration Rehearsal" description="Run disposable database rehearsal" icon={<Database className="h-5 w-5" />} action={<MigrationRehearsalCard />} />
                <QuickActionCard title="System Health" description="Monitor platform health metrics" icon={<Activity className="h-5 w-5" />} href="/platform/health" />
                <QuickActionCard title="Global Search" description="Search across all schools, users, cohorts" icon={<Search className="h-5 w-5" />} href="/platform/search" />
                <QuickActionCard title="Import History" description="View import history across all schools" icon={<Upload className="h-5 w-5" />} href="/platform/imports" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schools Tab */}
        <TabsContent value="schools">
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Schools ({filteredSchools.length}/{schools.length})</CardTitle>
                <CardDescription>Manage all schools on the platform</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search schools..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Button onClick={() => setActiveTab("overview")}><Plus className="mr-2 h-4 w-4" /> Create School</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredSchools.map((school) => <SchoolRow key={school.id} school={school} />)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Platform Analytics</CardTitle>
              <CardDescription>Cross-school analytics and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalyticsDashboard schools={schools} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Logs className="h-5 w-5" /> Audit Log</CardTitle>
              <CardDescription>System-wide audit events</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditLogViewer />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Migration Tab */}
        <TabsContent value="migration">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Migration Rehearsal</CardTitle>
              <CardDescription>Run disposable database migration rehearsals</CardDescription>
            </CardHeader>
            <CardContent>
              <MigrationRehearsalCard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Platform Settings</CardTitle>
              <CardDescription>Global platform configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <PlatformSettings />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search">
          <GlobalSearch />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-secondary p-2">{icon}</div>
      </div>
    </Card>
  );
}

function QuickActionCard({ title, description, icon, action, href }: { title: string; description: string; icon: React.ReactNode; action?: React.ReactNode; href?: string }) {
  return (
    <Card className={href ? "cursor-pointer hover:border-accent transition-colors" : ""} onClick={href ? () => window.location.href = href : undefined}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-secondary p-2">{icon}</div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {action}
      </CardContent>
    </Card>
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
          <div className="flex items-center gap-2">
            <code className="rounded bg-secondary px-2 py-1 font-mono text-sm">{school.code ?? "No code"}</code>
            <Badge variant={school.disabled ? "danger" : "success"}>{school.disabled ? "Disabled" : "Active"}</Badge>
            <Badge variant={school.isLegacy ? "secondary" : "outline"}>Legacy: {school.isLegacy ? "Yes" : "No"}</Badge>
          </div>
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
          <Button variant="outline" onClick={() => window.location.href = `/platform/schools/${school.id}`}>
            <Eye className="mr-2 h-4 w-4" /> View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Placeholder components for analytics, audit, migration, settings
function AnalyticsDashboard({ schools }: { schools: PlatformSchoolView[] }) {
  const totalStudents = schools.reduce((sum, s) => sum + s.studentCount, 0);
  const totalTeachers = schools.reduce((sum, s) => sum + s.teacherCount, 0);
  const totalCohorts = schools.reduce((sum, s) => sum + s.cohortCount, 0);
  const totalCourses = schools.reduce((sum, s) => sum + s.courseCount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Students" value={totalStudents} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Total Staff" value={totalTeachers} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Total Cohorts" value={totalCohorts} icon={<Building2 className="h-5 w-5" />} />
        <StatCard title="Total Courses" value={totalCourses} icon={<Building2 className="h-5 w-5" />} />
      </div>
      <Card>
        <CardHeader><CardTitle>Schools Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {schools.map((school) => (
              <div key={school.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                <div>
                  <p className="font-medium">{school.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {school.teacherCount} staff · {school.cohortCount} cohorts · {school.courseCount} courses · {school.studentCount} students
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={school.disabled ? "danger" : "success"}>{school.disabled ? "Disabled" : "Active"}</Badge>
                  <Badge variant={school.isLegacy ? "secondary" : "outline"}>Legacy: {school.isLegacy ? "Yes" : "No"}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AuditLogViewer() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">Audit log viewer - shows system-wide audit events</p>
      <Card>
        <CardHeader><CardTitle>Recent Audit Events</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Connect to auditEvent table to display recent events</p>
        </CardContent>
      </Card>
    </div>
  );
}

function MigrationRehearsalCard() {
  const [pending, setPending] = useState(false);
  const [output, setOutput] = useState<string[]>([]);

  async function runRehearsal() {
    setPending(true);
    setOutput(["Starting migration rehearsal..."]);
    try {
      const res = await fetch("/api/platform/migration/rehearse", { method: "POST" });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setOutput(prev => [...prev, ...chunk.split("\n").filter(Boolean)]);
      }
      setOutput(prev => [...prev, "Rehearsal complete!"]);
    } catch (e) {
      setOutput(prev => [...prev, `Error: ${e instanceof Error ? e.message : String(e)}`]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={runRehearsal} disabled={pending}>
          {pending ? "Running…" : "Run Migration Rehearsal"}
        </Button>
        <Button variant="outline" onClick={() => setOutput([])}>Clear Output</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Rehearsal Output</CardTitle></CardHeader>
        <CardContent>
          <pre className="font-mono text-sm max-h-96 overflow-y-auto bg-muted p-4 rounded">
            {output.length === 0 ? "Click 'Run Migration Rehearsal' to start" : output.join("\n")}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function PlatformSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Platform Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Student Email Domain</Label>
              <Input placeholder="students.example.com" disabled />
              <p className="text-xs text-muted-foreground">Configured via NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN</p>
            </div>
            <div className="space-y-2">
              <Label>Firebase Project</Label>
              <Input placeholder="your-project" disabled />
              <p className="text-xs text-muted-foreground">Configured via NEXT_PUBLIC_FIREBASE_PROJECT_ID</p>
            </div>
            <div className="space-y-2">
              <Label>Pusher Cluster</Label>
              <Input placeholder="mt1" disabled />
              <p className="text-xs text-muted-foreground">Configured via NEXT_PUBLIC_PUSHER_CLUSTER</p>
            </div>
            <div className="space-y-2">
              <Label>Storage Endpoint</Label>
              <Input placeholder="https://..." disabled />
              <p className="text-xs text-muted-foreground">Configured via AWS_ENDPOINT_URL_S3</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
