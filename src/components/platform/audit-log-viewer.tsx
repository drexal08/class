"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface AuditEvent {
  id: string;
  schoolId: string | null;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function AuditLogViewer() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [filters, setFilters] = useState({
    schoolId: "",
    actorId: "",
    action: "",
    targetType: "",
    from: "",
    to: "",
  });

  async function loadEvents() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String((page - 1) * limit),
      });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const res = await fetch(`/api/platform/audit?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load audit events");
      const data = await res.json();
      setEvents(data.events);
      setTotal(data.total);
    } catch (error) {
      toast.error("Failed to load audit events");
    } finally {
      setLoading(false);
    }
  }

  async function applyFilters() {
    setPage(1);
    await loadEvents();
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Audit Log</span>
          <Badge variant="outline">{total} events</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label htmlFor="school-filter">School ID</Label>
            <Input
              id="school-filter"
              placeholder="School ID"
              value={filters.schoolId}
              onChange={(e) => setFilters((prev) => ({ ...prev, schoolId: e.target.value }))}
            />
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label htmlFor="action-filter">Action</Label>
            <Input
              id="action-filter"
              placeholder="Action (e.g., SCHOOL_CREATED)"
              value={filters.action}
              onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
            />
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label htmlFor="target-filter">Target Type</Label>
            <Select value={filters.targetType} onValueChange={(v) => setFilters((prev) => ({ ...prev, targetType: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                <SelectItem value="School">School</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Cohort">Cohort</SelectItem>
                <SelectItem value="Course">Course</SelectItem>
                <SelectItem value="SchoolMember">SchoolMember</SelectItem>
                <SelectItem value="CohortMember">CohortMember</SelectItem>
                <SelectItem value="JoinCode">JoinCode</SelectItem>
                <SelectItem value="AssignmentGroup">AssignmentGroup</SelectItem>
                <SelectItem value="CohortImport">CohortImport</SelectItem>
                <SelectItem value="ClaimDispute">ClaimDispute</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label htmlFor="from-filter">From</Label>
            <Input
              id="from-filter"
              type="datetime-local"
              value={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
            />
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label htmlFor="to-filter">To</Label>
            <Input
              id="to-filter"
              type="datetime-local"
              value={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} disabled={loading}>
              <Search className="mr-2 h-4 w-4" /> Apply Filters
            </Button>
            <Button variant="outline" onClick={() => setFilters({ schoolId: "", actorId: "", action: "", targetType: "", from: "", to: "" })} disabled={loading}>
              Clear
            </Button>
          </div>
        </div>

        {/* Events Table */}
        {(() => {
          if (loading) {
            return (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            );
          }
          if (events.length === 0) {
            return <p className="text-center text-muted-foreground py-8">No audit events found.</p>;
          }
          return (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">Time</th>
                      <th className="text-left p-3 text-sm font-medium">Action</th>
                      <th className="text-left p-3 text-sm font-medium">Target</th>
                      <th className="text-left p-3 text-sm font-medium">Actor</th>
                      <th className="text-left p-3 text-sm font-medium">School</th>
                      <th className="text-left p-3 text-sm font-medium">Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {events.map((event) => (
                      <tr key={event.id} className="hover:bg-muted/50">
                        <td className="p-3 text-sm text-muted-foreground font-mono">
                          {format(new Date(event.createdAt), "yyyy-MM-dd HH:mm:ss")}
                        </td>
                        <td className="p-3 text-sm font-medium">{event.action}</td>
                        <td className="p-3 text-sm">
                          {event.targetType} {event.targetId ? <code className="font-mono text-xs ml-1">{event.targetId.slice(0, 12)}</code> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 text-sm">
                          <code className="font-mono text-xs">{event.actorId.slice(0, 12)}</code>
                        </td>
                        <td className="p-3 text-sm">
                          {event.schoolId ? <code className="font-mono text-xs">{event.schoolId.slice(0, 12)}</code> : <span className="text-muted-foreground">Global</span>}
                        </td>
                        <td className="p-3 text-sm">
                          <pre className="font-mono text-xs text-muted-foreground max-w-xs overflow-hidden">{JSON.stringify(event.metadata, null, 2)}</pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} · {total} total events
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          );
        })()}
      </CardContent>
    </Card>
  );
}