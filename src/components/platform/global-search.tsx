"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ChevronLeft, ChevronRight, Building2, Users, BookOpen, GraduationCap } from "lucide-react";
import { format } from "date-fns";

interface SearchResult {
  schools?: Array<{
    id: string;
    name: string;
    slug: string;
    isLegacy: boolean;
    disabledAt: string | null;
    joinCodes: Array<{ code: string }>;
  }>;
  users?: Array<{
    id: string;
    email: string;
    displayName: string | null;
    studentCode: string | null;
    role: string;
    platformRole: string | null;
    authKind: string;
    createdAt: string;
    _count: { enrollments: number; createdCourses: number };
  }>;
  cohorts?: Array<{
    id: string;
    label: string;
    grade: string;
    academicYear: number;
    school: { id: string; name: string };
    combination: { name: string };
    _count: { members: number };
  }>;
  courses?: Array<{
    id: string;
    name: string;
    code: string;
    subject: string | null;
    kind: string;
    school: { id: string; name: string } | null;
    cohort: { id: string; label: string } | null;
    teacher: { displayName: string | null; email: string } | null;
    _count: { enrollments: number };
  }>;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "schools" | "users" | "cohorts" | "courses">("all");
  const handleTypeChange = (value: "all" | "schools" | "users" | "cohorts" | "courses") => setType(value);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        type,
        limit: "20",
      });
      const res = await fetch(`/api/platform/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data);
    } catch (error) {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      await handleSearch();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Global Search</CardTitle>
        <CardDescription>Search across schools, users, cohorts, and courses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[300px]">
            <Label htmlFor="global-search">Search query</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="global-search"
                placeholder="Search schools, users, cohorts, courses..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="search-type">Type</Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="schools">Schools</SelectItem>
                <SelectItem value="users">Users</SelectItem>
                <SelectItem value="cohorts">Cohorts</SelectItem>
                <SelectItem value="courses">Courses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>

        {results && (
          <div className="space-y-6">
            {results.schools && results.schools.length > 0 && (
              <ResultSection
                title={`Schools (${results.schools.length})`}
                icon={<Building2 className="h-5 w-5" />}
                items={results.schools}
                renderItem={(school: { id: string; name: string; slug: string; isLegacy: boolean; disabledAt: string | null; joinCodes: Array<{ code: string }> }) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{school.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {school.slug} · {school.joinCodes[0]?.code ?? "No code"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={school.disabledAt ? "danger" : "success"}>
                        {school.disabledAt ? "Disabled" : "Active"}
                      </Badge>
                      <Badge variant={school.isLegacy ? "secondary" : "outline"}>
                        {school.isLegacy ? "Legacy" : "Standard"}
                      </Badge>
                    </div>
                  </div>
                )}
              />
            )}

            {results.users && results.users.length > 0 && (
              <ResultSection
                title={`Users (${results.users.length})`}
                icon={<Users className="h-5 w-5" />}
                items={results.users}
                renderItem={(user: { id: string; email: string; displayName: string | null; studentCode: string | null; role: string; platformRole: string | null; authKind: string; createdAt: string; _count: { enrollments: number; createdCourses: number } }) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{user.displayName ?? "—"}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.email} · {user.studentCode ? <code className="font-mono text-xs">{user.studentCode}</code> : <span>No student code</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{user.role}</Badge>
                      {user.platformRole && <Badge variant="secondary">{user.platformRole}</Badge>}
                    </div>
                  </div>
                )}
              />
            )}

            {results.cohorts && results.cohorts.length > 0 && (
              <ResultSection
                title={`Cohorts (${results.cohorts.length})`}
                icon={<GraduationCap className="h-5 w-5" />}
                items={results.cohorts}
                renderItem={(cohort: { id: string; label: string; grade: string; academicYear: number; school: { id: string; name: string }; combination: { name: string }; _count: { members: number } }) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{cohort.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {cohort.grade} · {cohort.combination.name} · {cohort.academicYear}/{cohort.academicYear + 1}
                        · {cohort.school.name}
                      </p>
                    </div>
                    <Badge variant="outline">{cohort._count.members} students</Badge>
                  </div>
                )}
              />
            )}

            {results.courses && results.courses.length > 0 && (
              <ResultSection
                title={`Courses (${results.courses.length})`}
                icon={<BookOpen className="h-5 w-5" />}
                items={results.courses}
                renderItem={(course: { id: string; name: string; code: string; subject: string | null; kind: string; school: { id: string; name: string } | null; cohort: { id: string; label: string } | null; teacher: { displayName: string | null; email: string } | null; _count: { enrollments: number } }) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{course.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {course.code} · {course.kind} · {course.subject ?? "No subject"}
                        {course.school && <span> · {course.school.name}</span>}
                      </p>
                    </div>
                    <Badge variant="outline">{course.kind}</Badge>
                  </div>
                )}
              />
            )}

            {!results.schools?.length && !results.users?.length && !results.cohorts?.length && !results.courses?.length && (
              <p className="text-center text-muted-foreground py-8">No results found.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultSection<T>({
  title,
  icon,
  items,
  renderItem,
}: {
  title: string;
  icon: React.ReactNode;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {items.map((item, index) => (
            <div key={index} className="p-3 rounded-lg bg-secondary flex items-center justify-between">
              {renderItem(item)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}