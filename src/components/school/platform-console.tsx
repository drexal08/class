"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Users, Building2, AlertTriangle, Database, Logs, Settings, Download, Upload, Eye, Activity, ChevronLeft, ChevronRight, LayoutDashboard, School, BarChart3, FileText, Search as SearchIcon, Server, Cog, Users as UsersIcon, MoreHorizontal, UserRoundSearch, Merge, Copy, TrendingUp, TrendingDown, Shield, Globe, Key, Zap, PieChart } from "lucide-react";
import { GlobalSearch } from "@/components/platform/global-search";
import {
  appointSchoolAdminAction,
  createSchoolAction,
  setSchoolDisabledAction,
} from "@/lib/actions/school-admin-actions";
import { mergeAccountsAction } from "@/lib/actions/merge-account-action";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";
import { cn, accentClasses } from "@/lib/utils";

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

type TabValue = "overview" | "schools" | "analytics" | "audit" | "migration" | "search" | "settings" | "account-merge";

const TABS: { value: TabValue; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, description: "System-wide statistics and quick actions" },
  { value: "schools", label: "Schools", icon: <Building2 className="h-4 w-4" />, description: "Manage all schools on the platform" },
  { value: "analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" />, description: "Cross-school analytics and trends" },
  { value: "audit", label: "Audit Log", icon: <FileText className="h-4 w-4" />, description: "System-wide audit events" },
  { value: "migration", label: "Migration", icon: <Server className="h-4 w-4" />, description: "Run disposable database migration rehearsals" },
  { value: "search", label: "Search", icon: <SearchIcon className="h-4 w-4" />, description: "Search across all schools, users, cohorts" },
  { value: "account-merge", label: "Account Merge", icon: <Merge className="h-4 w-4" />, description: "Find and merge duplicate user accounts" },
  { value: "settings", label: "Settings", icon: <Cog className="h-4 w-4" />, description: "Global platform configuration" },
];

export function PlatformConsole({ schools }: { schools: PlatformSchoolView[] }) {
  const [activeTab, setActiveTab] = useState<TabValue>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const activeTabConfig = TABS.find(t => t.value === activeTab)!;

  // Calculate trends (mock data for demonstration)
  const trends = {
    students: { value: "+12%", label: "vs last month", positive: true },
    teachers: { value: "+5%", label: "vs last month", positive: true },
    schools: { value: "+2", label: "new this quarter", positive: true },
    activity: { value: "2.3k", label: "active sessions today", positive: true },
  };

  return (
    <div className="flex h-full min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-200",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
        aria-label="Platform navigation"
      >
        {/* Header */}
        <div className={cn("flex items-center justify-between h-16 px-4 border-b border-border", sidebarCollapsed && "justify-center")}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary p-2">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg truncate">Platform</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Main navigation">
          <div className="h-full overflow-y-auto">
            <div className="space-y-1">
              {TABS.map((tab) => (
                <Button
                  key={tab.value}
                  variant={activeTab === tab.value ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 text-left transition-colors",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                  onClick={() => setActiveTab(tab.value)}
                  aria-current={activeTab === tab.value ? "page" : undefined}
                  title={sidebarCollapsed ? tab.label : undefined}
                >
                  <span className="flex-shrink-0">{tab.icon}</span>
                  {!sidebarCollapsed && (
                    <span className="flex-1 text-left">
                      <span className="font-medium block">{tab.label}</span>
                      <span className="text-xs text-muted-foreground block truncate">{tab.description}</span>
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className={cn("p-3 border-t border-border", sidebarCollapsed && "hidden")}>
          <div className="text-xs text-muted-foreground text-center">
            {schools.length} school{schools.length !== 1 ? "s" : ""} &bull; {stats.totalStudents.toLocaleString()} students
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{activeTabConfig.label}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{activeTabConfig.description}</p>
            </div>
            {activeTab === "schools" && !sidebarCollapsed && (
              <Button onClick={() => setActiveTab("overview")}><Plus className="mr-2 h-4 w-4" /> Create School</Button>
            )}
          </div>

          {/* Stats Cards (Overview only) */}
          {activeTab === "overview" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <EnhancedStatCard
                title="Total Schools"
                value={stats.totalSchools}
                icon={<Building2 className="h-5 w-5" />}
                trend={trends.schools}
                accent="primary"
              />
              <EnhancedStatCard
                title="Active Schools"
                value={stats.activeSchools}
                icon={<Activity className="h-5 w-5" />}
                trend={{ value: `${Math.round(stats.activeSchools / stats.totalSchools * 100)}%`, label: "of total", positive: true }}
                accent="success"
              />
              <EnhancedStatCard
                title="Total Students"
                value={stats.totalStudents}
                icon={<Users className="h-5 w-5" />}
                trend={trends.students}
                accent="info"
              />
              <EnhancedStatCard
                title="Total Staff"
                value={stats.totalTeachers}
                icon={<UsersIcon className="h-5 w-5" />}
                trend={trends.teachers}
                accent="warning"
              />
            </div>
          )}

          {/* Tab Content */}
          <div className="space-y-6">
            {activeTab === "overview" && <OverviewTab stats={stats} trends={trends} />}
            {activeTab === "schools" && <SchoolsTab schools={filteredSchools} allSchools={schools} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onCreateSchool={() => setActiveTab("overview")} />}
            {activeTab === "analytics" && <AnalyticsTab schools={schools} />}
            {activeTab === "audit" && <AuditTab />}
            {activeTab === "migration" && <MigrationTab />}
            {activeTab === "search" && <SearchTab />}
            {activeTab === "account-merge" && <AccountMergeTab />}
            {activeTab === "settings" && <SettingsTab />}
          </div>
        </div>
      </main>
    </div>
  );
}

function EnhancedStatCard({
  title,
  value,
  icon: Icon,
  trend,
  accent,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: { value: string; label: string; positive: boolean } | null;
  accent: "primary" | "success" | "warning" | "info";
}) {
  const accentStyles = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info",
  };

  const trendColors = {
    positive: "text-success",
    negative: "text-destructive",
  };

  return (
    <Card className="p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className={cn("text-xs font-medium", trendColors[trend.positive ? "positive" : "negative"])}>
                {trend.value}
              </span>
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn("rounded-lg p-2", accentStyles[accent])}>
          {Icon}
        </div>
      </div>
    </Card>
  );
}

function QuickActionCard({ title, description, icon, action, href }: { title: string; description: string; icon: React.ReactNode; action?: React.ReactNode; href?: string }) {
  return (
    <Card className={cn("transition-all duration-200 hover:shadow-md hover:border-primary/20", href && "cursor-pointer")} onClick={href ? () => window.location.href = href : undefined}>
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
      <Button className="w-fit" disabled={pending}>{pending ? "Creating&hellip;" : "Create school"}</Button>
    </form>
  );
}

function OverviewTab({ stats, trends }: { stats: { totalSchools: number; activeSchools: number; legacySchools: number; totalStudents: number; totalTeachers: number; totalCohorts: number; totalCourses: number }; trends: { students: { value: string; label: string; positive: boolean }; teachers: { value: string; label: string; positive: boolean }; schools: { value: string; label: string; positive: boolean }; activity: { value: string; label: string; positive: boolean } } }) {
  return (
    <div className="space-y-6">
      {/* Platform Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" /> Platform Health</CardTitle>
          <CardDescription>Real-time system status and performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <HealthMetric label="API Latency" value="42ms" status="healthy" icon={<Activity className="h-4 w-4" />} />
            <HealthMetric label="Database" value="99.9%" status="healthy" icon={<Database className="h-4 w-4" />} />
            <HealthMetric label="Storage" value="2.3 GB" status="warning" icon={<Upload className="h-4 w-4" />} />
            <HealthMetric label="Realtime" value="Connected" status="healthy" icon={<Globe className="h-4 w-4" />} />
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutDashboard className="h-5 w-5" /> Quick Actions</CardTitle>
          <CardDescription>Common platform operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickActionCard title="Create School" description="Add a new school to the platform" icon={<Plus className="h-5 w-5" />} action={<CreateSchoolForm />} />
            <QuickActionCard title="View Audit Log" description="Review system-wide audit events" icon={<FileText className="h-5 w-5" />} href="/platform/audit" />
            <QuickActionCard title="Migration Rehearsal" description="Run disposable database rehearsal" icon={<Server className="h-5 w-5" />} action={<MigrationRehearsalCard />} />
            <QuickActionCard title="System Health" description="Monitor platform health metrics" icon={<Activity className="h-5 w-5" />} href="/platform/health" />
            <QuickActionCard title="Global Search" description="Search across all schools, users, cohorts" icon={<SearchIcon className="h-5 w-5" />} href="/platform/search" />
            <QuickActionCard title="Import History" description="View import history across all schools" icon={<Upload className="h-5 w-5" />} href="/platform/imports" />
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Key Metrics</CardTitle>
          <CardDescription>Platform-wide aggregated statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricSummary label="Cohorts" value={stats.totalCohorts.toLocaleString()} icon={<School className="h-5 w-5" />} />
            <MetricSummary label="Courses" value={stats.totalCourses.toLocaleString()} icon={<BookOpen className="h-5 w-5" />} />
            <MetricSummary label="Legacy Schools" value={stats.legacySchools.toLocaleString()} icon={<AlertTriangle className="h-5 w-5" />} />
            <MetricSummary label="Active Sessions" value={trends.activity.value} icon={<Users className="h-5 w-5" />} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthMetric({ label, value, status, icon }: { label: string; value: string; status: "healthy" | "warning" | "critical"; icon: React.ReactNode }) {
  const statusStyles = {
    healthy: "text-success",
    warning: "text-warning",
    critical: "text-destructive",
  };
  const dotStyles = {
    healthy: "bg-success",
    warning: "bg-warning",
    critical: "bg-destructive",
  };
  return (
    <div className="p-4 rounded-lg border border-border bg-secondary/30">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("size-2 rounded-full", dotStyles[status])} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        <span className={cn("text-xs font-medium", statusStyles[status])}>{status}</span>
      </div>
    </div>
  );
}

function MetricSummary({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-4 rounded-lg border border-border bg-secondary/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

import { BookOpen } from "lucide-react";

function SchoolsTab({ schools, allSchools, searchQuery, setSearchQuery, onCreateSchool }: { schools: PlatformSchoolView[]; allSchools: PlatformSchoolView[]; searchQuery: string; setSearchQuery: (q: string) => void; onCreateSchool: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Schools ({schools.length}/{allSchools.length})</CardTitle>
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
          <Button onClick={onCreateSchool}><Plus className="mr-2 h-4 w-4" /> Create School</Button>
        </div>
      </CardHeader>
      <CardContent>
        {schools.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">No schools found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {schools.map((school) => <SchoolRow key={school.id} school={school} />)}
          </div>
        )}
      </CardContent>
    </Card>
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
    <Card className={cn(school.disabled ? "opacity-70" : undefined)}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{school.name}{school.isLegacy ? " (Legacy)" : ""}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {school.teacherCount} staff &bull; {school.cohortCount} cohorts &bull; {school.courseCount} courses &bull; {school.studentCount} students
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

function AnalyticsTab({ schools }: { schools: PlatformSchoolView[] }) {
  const totalStudents = schools.reduce((sum, s) => sum + s.studentCount, 0);
  const totalTeachers = schools.reduce((sum, s) => sum + s.teacherCount, 0);
  const totalCohorts = schools.reduce((sum, s) => sum + s.cohortCount, 0);
  const totalCourses = schools.reduce((sum, s) => sum + s.courseCount, 0);

  // Calculate distribution
  const avgStudentsPerSchool = schools.length > 0 ? Math.round(totalStudents / schools.length) : 0;
  const avgTeachersPerSchool = schools.length > 0 ? Math.round(totalTeachers / schools.length) : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <EnhancedStatCard title="Total Students" value={totalStudents} icon={<Users className="h-5 w-5" />} trend={{ value: "+12%", label: "vs last month", positive: true }} accent="info" />
        <EnhancedStatCard title="Total Staff" value={totalTeachers} icon={<UsersIcon className="h-5 w-5" />} trend={{ value: "+5%", label: "vs last month", positive: true }} accent="success" />
        <EnhancedStatCard title="Total Cohorts" value={totalCohorts} icon={<School className="h-5 w-5" />} trend={{ value: "+8%", label: "vs last quarter", positive: true }} accent="primary" />
        <EnhancedStatCard title="Total Courses" value={totalCourses} icon={<BookOpen className="h-5 w-5" />} trend={{ value: "+15%", label: "vs last quarter", positive: true }} accent="warning" />
      </div>

      {/* Distribution Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" /> School Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DistributionBar label="Students per School" value={avgStudentsPerSchool} max={Math.max(...schools.map(s => s.studentCount), 100)} color="bg-info" />
            <DistributionBar label="Teachers per School" value={avgTeachersPerSchool} max={Math.max(...schools.map(s => s.teacherCount), 50)} color="bg-success" />
            <DistributionBar label="Courses per School" value={schools.length > 0 ? Math.round(totalCourses / schools.length) : 0} max={Math.max(...schools.map(s => s.courseCount), 30)} color="bg-warning" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Growth Trends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrendRow label="Student Enrollment" value="+12.3%" period="MoM" positive icon={<TrendingUp className="h-4 w-4" />} />
            <TrendRow label="Teacher Signups" value="+5.1%" period="MoM" positive icon={<TrendingUp className="h-4 w-4" />} />
            <TrendRow label="New Schools" value="+2" period="QoQ" positive icon={<TrendingUp className="h-4 w-4" />} />
            <TrendRow label="Course Creation" value="+15.7%" period="QoQ" positive icon={<TrendingUp className="h-4 w-4" />} />
            <TrendRow label="Active Sessions" value="+8.2%" period="WoW" positive icon={<TrendingUp className="h-4 w-4" />} />
          </CardContent>
        </Card>
      </div>

      {/* Schools Breakdown Table */}
      <Card>
        <CardHeader><CardTitle>Schools Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {schools.map((school) => (
              <div key={school.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{school.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {school.teacherCount} staff &bull; {school.cohortCount} cohorts &bull; {school.courseCount} courses &bull; {school.studentCount} students
                    </p>
                  </div>
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

function DistributionBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function TrendRow({ label, value, period, positive, icon }: { label: string; value: string; period: string; positive: boolean; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">{icon}</div>
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{period}</p>
        </div>
      </div>
      <div className="text-right">
        <span className={cn("font-semibold", positive ? "text-success" : "text-destructive")}>{value}</span>
      </div>
    </div>
  );
}

function AuditTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Recent Audit Events</CardTitle>
              <CardDescription>System-wide audit trail</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Export</Button>
              <Button variant="outline" size="sm"><Search className="mr-2 h-4 w-4" /> Filter</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-muted-foreground">Connect to auditEvent table to display recent events</p>
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Audit log viewer - shows system-wide audit events</p>
              <p className="mt-2 text-sm text-muted-foreground">Events include: school creation, admin appointments, imports, migrations, settings changes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MigrationTab() {
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
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> Migration Rehearsal</CardTitle>
              <CardDescription>Run disposable database migration rehearsals</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={runRehearsal} disabled={pending}>
                {pending ? "Running&hellip;" : "Run Migration Rehearsal"}
              </Button>
              <Button variant="outline" onClick={() => setOutput([])}>Clear Output</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="font-mono text-sm max-h-96 overflow-y-auto bg-muted p-4 rounded">
            {output.length === 0 ? "Click 'Run Migration Rehearsal' to start" : output.join("\n")}
          </pre>
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
          {pending ? "Running&hellip;" : "Run Migration Rehearsal"}
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

function SearchTab() {
  return <GlobalSearch />;
}

function SettingsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            <CardTitle>Platform Configuration</CardTitle>
          </div>
          <CardDescription>Global settings managed via environment variables</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingItem label="Student Email Domain" value="students.example.com" env="NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN" icon={<Globe className="h-4 w-4" />} />
            <SettingItem label="Firebase Project" value="your-project" env="NEXT_PUBLIC_FIREBASE_PROJECT_ID" icon={<Key className="h-4 w-4" />} />
            <SettingItem label="Pusher Cluster" value="mt1" env="NEXT_PUBLIC_PUSHER_CLUSTER" icon={<Zap className="h-4 w-4" />} />
            <SettingItem label="Storage Endpoint" value="https://..." env="AWS_ENDPOINT_URL_S3" icon={<Database className="h-4 w-4" />} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingItem({ label, value, env, icon }: { label: string; value: string; env: string; icon: React.ReactNode }) {
  return (
    <div className="space-y-2 p-4 rounded-lg border border-border bg-secondary/30">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-secondary p-2">{icon}</span>
        <Label className="mb-0">{label}</Label>
      </div>
      <Input value={value} disabled className="bg-card" />
      <p className="text-xs text-muted-foreground">Configured via <code className="font-mono">{env}</code></p>
    </div>
  );
}

function AccountMergeTab() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mergeAccountsAction,
    EMPTY_ACTION_STATE,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedDuplicate, setSelectedDuplicate] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Mock user search - in production this would call an API
  const mockUsers = [
    { id: "user-1", email: "john.smith@example.com", displayName: "John Smith", role: "STUDENT", studentCode: "STU001", authKind: "STUDENT_CODE" },
    { id: "user-2", email: "j.smith@example.com", displayName: "J. Smith", role: "STUDENT", studentCode: "STU001", authKind: "GOOGLE" },
    { id: "user-3", email: "jane.doe@example.com", displayName: "Jane Doe", role: "TEACHER", studentCode: null, authKind: "GOOGLE" },
    { id: "user-4", email: "jane.doe@school.edu", displayName: "Jane Doe", role: "TEACHER", studentCode: null, authKind: "EMAIL_PASSWORD" },
    { id: "user-5", email: "bob.wilson@example.com", displayName: "Bob Wilson", role: "STUDENT", studentCode: "STU002", authKind: "STUDENT_CODE" },
    { id: "user-6", email: "b.wilson@example.com", displayName: "B. Wilson", role: "STUDENT", studentCode: "STU002", authKind: "GOOGLE" },
  ];

  const filteredUsers = mockUsers.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.studentCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedUsers = filteredUsers.reduce((acc, user) => {
    const key = user.studentCode || user.email.split("@")[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(user);
    return acc;
  }, {} as Record<string, typeof mockUsers>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Merge className="h-5 w-5" /> Account Merge</CardTitle>
              <CardDescription>
                Find and merge duplicate user accounts. Only superusers can perform merges.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {state.error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">{state.error}</div>}
          {state.success && <div className="rounded-lg bg-success/10 border border-success/20 p-4 text-success">Accounts merged successfully!</div>}

          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="user-search">Search Users</Label>
            <div className="relative">
              <UserRoundSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="user-search"
                placeholder="Search by email, name, or student code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">Type to filter users. Potential duplicates are highlighted.</p>
          </div>

          {/* Potential Duplicates Section */}
          {Object.keys(groupedUsers).some(key => groupedUsers[key].length > 1) && (
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Potential Duplicates ({Object.entries(groupedUsers).filter(([, v]) => v.length > 1).length} groups)
              </h4>
              <div className="space-y-3">
                {Object.entries(groupedUsers)
                  .filter(([, users]) => users.length > 1)
                  .map(([key, users]) => (
                    <Card key={key} className="border-warning/30 bg-warning/5">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-medium">Group: {key} ({users.length} accounts)</p>
                        </div>
                        <div className="space-y-2">
                          {users.map((user, index) => (
                            <label
                              key={user.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                selectedPrimary === user.id || selectedDuplicate === user.id ? "border-accent bg-accent/5" : "border-border hover:bg-secondary/50"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`primary-${key}`}
                                value={user.id}
                                checked={selectedPrimary === user.id}
                                onChange={() => {
                                  setSelectedPrimary(user.id);
                                  if (selectedDuplicate === user.id) setSelectedDuplicate(null);
                                }}
                                className="h-4 w-4 text-accent"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{user.displayName || user.email}</span>
                                  <Badge variant="outline" className="text-xs">{user.role}</Badge>
                                  <Badge variant="secondary" className="text-xs">{user.authKind}</Badge>
                                  {user.studentCode && <Badge variant="default" className="text-xs">{user.studentCode}</Badge>}
                                </div>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                              <span className="text-xs text-muted-foreground">{index === 0 ? "Primary" : "Duplicate"}</span>
                            </label>
                          ))}
                        </div>
                        {selectedPrimary && users.find(u => u.id === selectedPrimary) && selectedDuplicate && (
                          <div className="mt-3 p-3 rounded-lg bg-muted">
                            <p className="text-sm">
                              Ready to merge <strong>{users.find(u => u.id === selectedDuplicate)?.displayName}</strong>
                              into <strong>{users.find(u => u.id === selectedPrimary)?.displayName}</strong>
                            </p>
                            <div className="mt-2 flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedDuplicate(null);
                                  setSelectedPrimary(null);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => setShowConfirm(true)}>
                                Confirm Merge
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* All Users List */}
          <div className="space-y-4">
            <h4 className="font-medium">All Users ({filteredUsers.length})</h4>
            <div className="rounded-lg border border-border overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-secondary sticky top-0">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium w-10">Select</th>
                    <th className="text-left p-3 text-sm font-medium">Name</th>
                    <th className="text-left p-3 text-sm font-medium">Email</th>
                    <th className="text-left p-3 text-sm font-medium">Role</th>
                    <th className="text-left p-3 text-sm font-medium">Auth</th>
                    <th className="text-left p-3 text-sm font-medium">Student Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className={selectedPrimary === user.id || selectedDuplicate === user.id ? "bg-accent/5" : undefined}>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="primary-global"
                              value={user.id}
                              checked={selectedPrimary === user.id}
                              onChange={() => {
                                setSelectedPrimary(user.id);
                                if (selectedDuplicate === user.id) setSelectedDuplicate(null);
                              }}
                              className="h-4 w-4 text-accent"
                            />
                            <span className="text-xs text-muted-foreground">Primary</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="duplicate-global"
                              value={user.id}
                              checked={selectedDuplicate === user.id}
                              onChange={() => {
                                setSelectedDuplicate(user.id);
                                if (selectedPrimary === user.id) setSelectedPrimary(null);
                              }}
                              className="h-4 w-4 text-destructive"
                            />
                            <span className="text-xs text-muted-foreground">Duplicate</span>
                          </label>
                        </div>
                      </td>
                      <td className="p-3 text-sm font-medium">{user.displayName || "—"}</td>
                      <td className="p-3 text-sm">{user.email}</td>
                      <td className="p-3 text-sm"><Badge variant="outline">{user.role}</Badge></td>
                      <td className="p-3 text-sm"><Badge variant="secondary">{user.authKind}</Badge></td>
                      <td className="p-3 text-sm font-mono">{user.studentCode || "—"}</td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">No users found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Merge Action Form */}
          {(selectedPrimary && selectedDuplicate) && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive"><Merge className="h-5 w-5" /> Confirm Merge</CardTitle>
                <CardDescription>This action is irreversible. The duplicate account will be archived and all data reassigned.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={formAction} className="space-y-4">
                  <input type="hidden" name="primaryUserId" value={selectedPrimary} />
                  <input type="hidden" name="duplicateUserId" value={selectedDuplicate} />
                  <div className="space-y-2">
                    <Label htmlFor="confirmation">Type &ldquo;MERGE&rdquo; to confirm</Label>
                    <Input
                      id="confirmation"
                      name="confirmation"
                      required
                      placeholder="MERGE"
                      maxLength={5}
                      onChange={(e) => {
                        if (e.target.value === "MERGE") setShowConfirm(true);
                        else setShowConfirm(false);
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={pending || !showConfirm} variant="destructive">
                      {pending ? "Merging…" : "Merge Accounts"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setSelectedPrimary(null); setSelectedDuplicate(null); setShowConfirm(false); }}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Select one user as Primary and another as Duplicate, then type &ldquo;MERGE&rdquo; to confirm.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}