"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Users, GraduationCap, AlertTriangle, Upload, RotateCcw, Settings, Building2, UserPlus, MoreHorizontal, ArrowRight, Copy, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { promoteCohortAction } from "@/lib/actions/promotion-action";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";
import { useActionState, useState } from "react";

type AdminTab = "teachers" | "cohorts" | "disputes" | "imports" | "codes" | "settings" | "promotion";

const TABS: { value: AdminTab; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "teachers", label: "Teachers", icon: <Users className="h-4 w-4" />, description: "Manage teacher memberships and approvals" },
  { value: "cohorts", label: "Cohorts", icon: <GraduationCap className="h-4 w-4" />, description: "View and manage cohorts" },
  { value: "disputes", label: "Disputes", icon: <AlertTriangle className="h-4 w-4" />, description: "Handle claim disputes" },
  { value: "imports", label: "Imports", icon: <Upload className="h-4 w-4" />, description: "Import history and new imports" },
  { value: "codes", label: "Join Codes", icon: <RotateCcw className="h-4 w-4" />, description: "Manage school and cohort join codes" },
  { value: "promotion", label: "Promotion", icon: <ArrowRight className="h-4 w-4" />, description: "Promote cohorts to next academic year" },
  { value: "settings", label: "Settings", icon: <Settings className="h-4 w-4" />, description: "School configuration" },
];

interface School {
  id: string;
  name: string;
  slug: string;
  isLegacy: boolean;
  disabledAt: Date | null;
  joinCodes: Array<{ code: string }>;
  requiresApproval: boolean;
}

interface Cohort {
  id: string;
  label: string;
  grade: string;
  combination: { name: string };
  academicYear: number;
  _count: { members: number; courses: number };
  joinCodes: Array<{ code: string }>;
}

interface Member {
  id: string;
  userId: string;
  role: "ADMIN" | "TEACHER";
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  user: { displayName: string | null; email: string; studentCode: string | null };
}

interface SchoolAdminLayoutProps {
  school: School;
  cohorts: Cohort[];
  members: Member[];
}

export function SchoolAdminLayout({ school, cohorts, members }: SchoolAdminLayoutProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("teachers");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTabConfig = TABS.find(t => t.value === activeTab)!;

  // Check if we're in a cohort-specific view
  const cohortId = searchParams.get("cohort");

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-200",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
        aria-label="School admin navigation"
      >
        {/* Header */}
        <div className={cn("flex items-center justify-between h-16 px-4 border-b border-border", sidebarCollapsed && "justify-center")}>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg truncate">{school.name}</p>
              <p className="text-xs text-muted-foreground truncate">{school.slug}</p>
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
          <div className="space-y-1">
            {TABS.map((tab) => (
                <Button
                  key={tab.value}
                  variant={activeTab === tab.value ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 text-left transition-colors",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                  onClick={() => {
                    setActiveTab(tab.value);
                    // Clear cohort filter when switching tabs
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete("cohort");
                    router.push(`/admin?${params.toString()}`);
                  }}
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
          </nav>

        {/* Footer */}
        <div className={cn("p-3 border-t border-border", sidebarCollapsed && "hidden")}>
          <div className="text-xs text-muted-foreground text-center">
            {cohorts.length} cohort{cohorts.length !== 1 ? "s" : ""} &bull; {members.filter(m => m.status === "ACTIVE").length} active teachers
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
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {activeTab === "teachers" && <TeachersTab schoolId={school.id} members={members} requiresApproval={school.requiresApproval} />}
            {activeTab === "cohorts" && <CohortsTab cohorts={cohorts} />}
            {activeTab === "disputes" && <DisputesTab cohorts={cohorts} />}
            {activeTab === "imports" && <ImportsTab schoolId={school.id} cohorts={cohorts} />}
            {activeTab === "codes" && <CodesTab schoolId={school.id} schoolCode={school.joinCodes[0]?.code ?? null} cohorts={cohorts} />}
            {activeTab === "promotion" && <PromotionTab schoolId={school.id} cohorts={cohorts} />}
            {activeTab === "settings" && <SettingsTab school={school} />}
          </div>
        </div>
      </main>
    </div>
  );
}

function TeachersTab({ schoolId, members, requiresApproval }: { schoolId: string; members: Member[]; requiresApproval: boolean }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Staff</CardTitle>
            <CardDescription>
              Pending requests require approval. Active teachers can be promoted to admin.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={requiresApproval ? "success" : "secondary"}>
              {requiresApproval ? "Approval required" : "Auto-approve"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member: Member) => (
              <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-border">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    {member.user.displayName?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{member.user.displayName || member.user.email}</p>
                    <p className="text-sm text-muted-foreground">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={member.status === "ACTIVE" ? "success" : member.status === "PENDING" ? "warning" : "secondary"}>
                    {member.status}
                  </Badge>
                  <Badge variant={member.role === "ADMIN" ? "default" : "outline"}>
                    {member.role}
                  </Badge>
                  {member.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">Approve</Button>
                      <Button variant="destructive" size="sm">Reject</Button>
                    </div>
                  )}
                  {member.status === "ACTIVE" && member.role === "TEACHER" && (
                    <Button variant="outline" size="sm">Promote to Admin</Button>
                  )}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No teachers yet. Share the school code to invite teachers.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CohortsTab({ cohorts }: { cohorts: Cohort[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Cohorts ({cohorts.length})</CardTitle>
          <CardDescription>All cohorts in this school. Click to view details.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cohorts.map((cohort: Cohort) => (
              <div key={cohort.id} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                <div>
                  <p className="font-medium">{cohort.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {cohort.grade} &bull; {cohort.combination.name} &bull; {cohort.academicYear}/{cohort.academicYear + 1}
                    &bull; {cohort._count.members} students &bull; {cohort._count.courses} courses
                  </p>
                </div>
                <div className="flex gap-2">
                  <code className="rounded bg-secondary px-2 py-1 font-mono text-sm">
                    {cohort.joinCodes[0]?.code ?? "—"}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/admin/cohort/${cohort.id}`}>
                    Open
                  </Button>
                </div>
              </div>
            ))}
            {cohorts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No cohorts yet. Import a spreadsheet to create cohorts.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DisputesTab({ cohorts }: { cohorts: Cohort[] }) {
  const firstCohortId = cohorts[0]?.id;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Claim Disputes</CardTitle>
          <CardDescription>Review and resolve student claim disputes</CardDescription>
        </CardHeader>
        <CardContent>
          {firstCohortId ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Dispute queue for cohort</p>
              <p className="mt-2 text-sm text-muted-foreground">Select a cohort to view disputes</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No cohorts available. Create a cohort first.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ImportsTab({ schoolId, cohorts }: { schoolId: string; cohorts: Cohort[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Import History</CardTitle>
          <CardDescription>View past imports and start new ones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Import history and new import</p>
            <p className="mt-2 text-sm text-muted-foreground">Upload a spreadsheet to create or update cohorts</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CodesTab({ schoolId, schoolCode, cohorts }: { schoolId: string; schoolCode: string | null; cohorts: Cohort[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5" /> Join Codes</CardTitle>
          <CardDescription>Manage school and cohort join codes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">School Join Code</p>
                  <p className="text-sm text-muted-foreground">Permanent code for teachers to join this school</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-secondary px-3 py-1 font-mono text-lg">{schoolCode ?? "—"}</code>
                  <Button variant="outline" size="sm">Copy</Button>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3">Cohort Join Codes</h4>
              <div className="space-y-2">
                {cohorts.map((cohort: Cohort) => (
                  <div key={cohort.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border">
                    <div>
                      <p className="font-medium">{cohort.label}</p>
                      <p className="text-sm text-muted-foreground">{cohort._count.members} students</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-secondary px-3 py-1 font-mono">{cohort.joinCodes[0]?.code ?? "—"}</code>
                      <Button variant="outline" size="sm">Rotate</Button>
                      <Button variant="outline" size="sm">Copy</Button>
                    </div>
                  </div>
                ))}
                {cohorts.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No cohorts yet</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab({ school }: { school: School }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> School Settings</CardTitle>
          <CardDescription>Configure school details and policies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>School Name</Label>
              <Input defaultValue={school.name} disabled />
              <p className="text-xs text-muted-foreground">Editing coming soon</p>
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input defaultValue={school.slug} disabled />
              <p className="text-xs text-muted-foreground">Cannot be changed</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Teacher Approval Required</p>
                <p className="text-sm text-muted-foreground">Teachers must be approved by an admin before accessing the school</p>
              </div>
              <Button variant="outline" size="sm">{school.requiresApproval ? "Enabled" : "Disabled"}</Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Legacy School</p>
                <p className="text-sm text-muted-foreground">Legacy schools contain migrated data from before school tenancy</p>
              </div>
              <Badge variant={school.isLegacy ? "secondary" : "outline"}>
                {school.isLegacy ? "Yes" : "No"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">School Status</p>
                <p className="text-sm text-muted-foreground">Disabled schools block sign-in but preserve data</p>
              </div>
              <Badge variant={school.disabledAt ? "danger" : "success"}>
                {school.disabledAt ? "Disabled" : "Active"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PromotionTab({ schoolId, cohorts }: { schoolId: string; cohorts: Cohort[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    promoteCohortAction,
    EMPTY_ACTION_STATE,
  );
  const [expandedCohortId, setExpandedCohortId] = useState<string | null>(null);

  const sortedCohorts = [...cohorts].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ArrowRight className="h-5 w-5" /> Promote Cohorts</CardTitle>
          <CardDescription>
            Create the next academic year cohorts by promoting current cohorts. Members are copied idempotently,
            source members are marked as MOVED, and homeroom enrollments are synced.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {state.error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">{state.error}</div>}
          {state.success && <div className="rounded-lg bg-success/10 border border-success/20 p-4 text-success">Cohort promoted successfully!</div>}

          <div className="space-y-4">
            {sortedCohorts.map((cohort) => (
              <div key={cohort.id} className="rounded-lg border border-border overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 bg-secondary/50 cursor-pointer hover:bg-secondary"
                  onClick={() => setExpandedCohortId(expandedCohortId === cohort.id ? null : cohort.id)}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{cohort.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {cohort.grade} &bull; {cohort.combination.name} &bull; {cohort.academicYear}/{cohort.academicYear + 1}
                        &bull; {cohort._count.members} students
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{cohort.academicYear}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="default">{cohort.academicYear + 1}</Badge>
                    <Button variant="ghost" size="icon" aria-label={expandedCohortId === cohort.id ? "Collapse" : "Expand"}>
                      {expandedCohortId === cohort.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {expandedCohortId === cohort.id && (
                  <form action={formAction} className="p-4 space-y-4 border-t border-border">
                    <input type="hidden" name="sourceCohortId" value={cohort.id} />
                    <input type="hidden" name="destinationAcademicYear" value={cohort.academicYear + 1} />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`dest-label-${cohort.id}`}>Destination Label</Label>
                        <Input
                          id={`dest-label-${cohort.id}`}
                          name="destinationLabel"
                          required
                          maxLength={120}
                          defaultValue={cohort.label}
                          placeholder="e.g., S5A, 10B"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`dest-grade-${cohort.id}`}>Destination Grade</Label>
                        <Input
                          id={`dest-grade-${cohort.id}`}
                          name="destinationGrade"
                          required
                          maxLength={20}
                          defaultValue={cohort.grade}
                          placeholder="e.g., S5, Year 10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`dest-combo-${cohort.id}`}>Combination</Label>
                      <Input
                        id={`dest-combo-${cohort.id}`}
                        name="destinationCombinationId"
                        required
                        defaultValue={cohort.combination.name}
                        placeholder="Combination name"
                      />
                      <p className="text-xs text-muted-foreground">Combination ID (not name). Use the combination short name or ID.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input type="checkbox" id={`retain-teacher-${cohort.id}`} name="retainHomeroomTeacher" />
                      <Label htmlFor={`retain-teacher-${cohort.id}`} className="mb-0">
                        Retain homeroom teacher (if current cohort has one)
                      </Label>
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                        {pending ? "Promoting…" : `Promote to ${cohort.academicYear + 1}`}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setExpandedCohortId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ))}
            {cohorts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No cohorts available to promote. Create a cohort first.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}