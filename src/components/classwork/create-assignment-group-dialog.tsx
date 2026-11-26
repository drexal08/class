"use client";

import { useActionState, useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check, ChevronDown, ChevronUp, Users, BookOpen, Megaphone, FolderKanban } from "lucide-react";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { createAssignmentGroupAction } from "@/lib/actions/classwork-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

type CohortWithCourses = {
  id: string;
  label: string;
  grade: string;
  combination: { id: string; name: string; shortName: string; stream: string | null };
  academicYear: number;
  courses: Array<{ id: string; name: string; subject: string | null; kind: string; code: string }>;
};

type TeacherCourse = {
  id: string;
  name: string;
  subject: string | null;
  kind: string;
  code: string;
  cohortId: string | null;
};

type Target = {
  type: "cohort" | "course";
  id: string;
  label: string;
  cohortLabel?: string;
  checked: boolean;
};

let nextCriterionKey = 0;

interface CreateAssignmentGroupDialogProps {
  schoolId: string;
  initialTargets?: Target[];
}

export function CreateAssignmentGroupDialog({ schoolId }: CreateAssignmentGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("ASSIGNMENT");
  const [mode, setMode] = useState<"ANNOUNCEMENT" | "SHARED_WORK">("SHARED_WORK");
  const [subject, setSubject] = useState("");
  const [targets, setTargets] = useState<Target[]>([]);
  const [criteria, setCriteria] = useState<number[]>([]);
  const [targetsLoaded, setTargetsLoaded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createAssignmentGroupAction,
    EMPTY_ACTION_STATE,
  );

  const isGraded = mode === "SHARED_WORK" && type !== "MATERIAL";

  const loadTargets = useCallback(async () => {
    try {
      const res = await fetch(`/api/school/${schoolId}/targets`);
      if (res.ok) {
        const data = await res.json();
        const newTargets: Target[] = [
          ...data.cohorts.flatMap((cohort: CohortWithCourses) => [
            { type: "cohort" as const, id: cohort.id, label: cohort.label, cohortLabel: cohort.label, checked: false },
            ...cohort.courses.map((course) => ({
              type: "course" as const,
              id: course.id,
              label: course.name,
              cohortLabel: cohort.label,
              checked: false,
            })),
          ]),
          ...data.teacherCourses.map((course: TeacherCourse) => ({
            type: "course" as const,
            id: course.id,
            label: course.name,
            checked: false,
          })),
        ];
        setTargets(newTargets);
      }
    } catch (error) {
      console.error("Failed to load targets:", error);
    } finally {
      setTargetsLoaded(true);
    }
  }, [schoolId]);

  // Load targets when dialog opens
  useEffect(() => {
    if (open && !targetsLoaded) {
      // Use a timeout to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        loadTargets();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, targetsLoaded, loadTargets]);

  function toggleTarget(id: string) {
    setTargets(prev => prev.map(t => t.id === id ? { ...t, checked: !t.checked } : t));
  }

  function toggleAllInSection(sectionTargets: Target[], checked: boolean) {
    setTargets(prev => prev.map(t => sectionTargets.some(st => st.id === t.id) ? { ...t, checked } : t));
  }

  function toggleSection(section: string) {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }

  function getSectionTargets(section: string): Target[] {
    if (section === "all") return targets;
    return targets.filter(t => {
      if (section === "cohorts") return t.type === "cohort";
      if (section === "courses") return t.type === "course";
      return false;
    });
  }

  function getCheckedCount(section?: string): number {
    const sectionTargets = section ? getSectionTargets(section) : targets;
    return sectionTargets.filter(t => t.checked).length;
  }

  function getTotalCount(section?: string): number {
    const sectionTargets = section ? getSectionTargets(section) : targets;
    return sectionTargets.length;
  }

  const cohortSections = targets
    .filter(t => t.type === "cohort")
    .reduce((acc, t) => {
      const key = t.cohortLabel || t.label;
      if (!acc[key]) acc[key] = [];
      acc[key].push(t);
      return acc;
    }, {} as Record<string, Target[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Set work
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Set work across classes</DialogTitle>
          <DialogDescription>
            Create an announcement or shared assignment for multiple classes at once.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="schoolId" value={schoolId} />
          <input type="hidden" name="mode" value={mode} />

          <FormError message={state.error} />

          {/* Mode Selection */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={mode === "ANNOUNCEMENT" ? "default" : "outline"}
                  className="h-auto p-4 text-left"
                  onClick={() => setMode("ANNOUNCEMENT")}
                >
                  <div className="flex items-start gap-3">
                    <Megaphone className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Announcement</p>
                      <p className="text-sm text-muted-foreground">
                        Visible to selected classes. No points, no rubric, no gradebook entry.
                      </p>
                    </div>
                  </div>
                </Button>
                <Button
                  type="button"
                  variant={mode === "SHARED_WORK" ? "default" : "outline"}
                  className="h-auto p-4 text-left"
                  onClick={() => setMode("SHARED_WORK")}
                >
                  <div className="flex items-start gap-3">
                    <FolderKanban className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Shared work</p>
                      <p className="text-sm text-muted-foreground">
                        Graded assignment. One copy per class with its own gradebook column.
                      </p>
                    </div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Subject (optional, for homeroom vs subject) */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject (optional)</Label>
            <Input
              id="subject"
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Mathematics, English Language Arts"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank for homeroom / class-wide work. Filled in for subject-specific work.
            </p>
          </div>

          {/* Targets */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Target classes</CardTitle>
                <Badge variant="outline">{getCheckedCount()} selected</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cohorts */}
              {Object.entries(cohortSections).length > 0 && (
                <Collapsible open={expandedSections["cohorts"] ?? true} onOpenChange={(open: boolean) => toggleSection("cohorts")}>
                  <CollapsibleTrigger className="w-full py-2 text-left font-medium hover:text-foreground">
                    <div className="flex items-center justify-between">
                      <span>Cohorts ({getCheckedCount("cohorts")}/{getTotalCount("cohorts")})</span>
                      <Checkbox
                        checked={getCheckedCount("cohorts") === getTotalCount("cohorts") && getTotalCount("cohorts") > 0}
                        onCheckedChange={(checked: boolean) => toggleAllInSection(getSectionTargets("cohorts"), checked)}
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {Object.entries(cohortSections).map(([cohortLabel, cohortTargets]) => (
                      <div key={cohortLabel} className="space-y-2 pl-4 border-l-2 border-border">
                        <div className="flex items-center justify-between py-1">
                          <span className="font-medium text-sm">{cohortLabel}</span>
                          <Checkbox
                            checked={cohortTargets.every(t => t.checked)}
                            onCheckedChange={(checked: boolean) => toggleAllInSection(cohortTargets, checked)}
                          />
                        </div>
                        {cohortTargets.map(target => (
                          <label key={target.id} className="flex items-center gap-2 py-1 cursor-pointer">
                            <Checkbox
                              checked={target.checked}
                              onCheckedChange={() => toggleTarget(target.id)}
                            />
                            <span className="text-sm">
                              {target.label} {target.type === "course" && <Badge variant="secondary" className="ml-1">Course</Badge>}
                            </span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Teacher's other courses */}
              {targets.filter(t => t.type === "course" && !t.cohortLabel).length > 0 && (
                <Collapsible open={expandedSections["other-courses"] ?? true} onOpenChange={(open: boolean) => toggleSection("other-courses")}>
                  <CollapsibleTrigger className="w-full py-2 text-left font-medium hover:text-foreground">
                    <div className="flex items-center justify-between">
                      <span>Your other courses ({getCheckedCount("courses")}/{getTotalCount("courses")})</span>
                      <Checkbox
                        checked={getCheckedCount("courses") === getTotalCount("courses") && getTotalCount("courses") > 0}
                        onCheckedChange={(checked: boolean) => toggleAllInSection(getSectionTargets("courses"), checked)}
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2 pl-4 border-l-2 border-border">
                    {targets.filter(t => t.type === "course" && !t.cohortLabel).map(target => (
                      <label key={target.id} className="flex items-center gap-2 py-1 cursor-pointer">
                        <Checkbox
                          checked={target.checked}
                          onCheckedChange={() => toggleTarget(target.id)}
                        />
                        <span className="text-sm">{target.label} <Badge variant="secondary" className="ml-1">Course</Badge></span>
                      </label>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {targets.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No classes found for this school.</p>
              )}
            </CardContent>
          </Card>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={300}
              autoFocus
              placeholder="Chapter 4 problem set"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Instructions</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              maxLength={10000}
              placeholder="What should students do? Include any context they need."
            />
          </div>

          {/* Type, Points, Due Date */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select name="type" value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                  <SelectItem value="QUIZ">Quiz</SelectItem>
                  <SelectItem value="QUESTION">Question</SelectItem>
                  <SelectItem value="MATERIAL">Material</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isGraded && (
              <div className="space-y-2">
                <Label htmlFor="maxPoints">Points</Label>
                <Input
                  id="maxPoints"
                  name="maxPoints"
                  type="number"
                  min={0}
                  max={10000}
                  defaultValue={100}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due</Label>
              <Input id="dueDate" name="dueDate" type="datetime-local" />
            </div>
          </div>

          {/* Rubric for graded work */}
          {isGraded && (
            <>
              <Separator />

              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Rubric</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional. Criteria appear beside the work while you grade.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCriteria((rows) => [...rows, (nextCriterionKey += 1)])
                    }
                  >
                    <Plus />
                    Add criterion
                  </Button>
                </div>

                {criteria.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {criteria.map((key) => (
                      <li key={key} className="flex items-center gap-2">
                        <Input
                          name="rubricTitle"
                          placeholder="e.g. Uses evidence"
                          maxLength={160}
                          className="flex-1"
                          aria-label="Criterion name"
                        />
                        <Input
                          name="rubricPoints"
                          type="number"
                          min={0}
                          max={1000}
                          defaultValue={10}
                          className="w-24"
                          aria-label="Criterion points"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove criterion"
                          onClick={() =>
                            setCriteria((rows) => rows.filter((r) => r !== key))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {/* Publishing options */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="published" name="published" defaultChecked />
              <Label htmlFor="published">Post immediately (uncheck to save as draft)</Label>
            </div>

            {isGraded && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox id="acceptingSubmissions" name="acceptingSubmissions" defaultChecked />
                  <Label htmlFor="acceptingSubmissions">Accepting submissions</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="allowLateSubmissions" name="allowLateSubmissions" defaultChecked />
                  <Label htmlFor="allowLateSubmissions">Allow late submissions</Label>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="submit"
              name="published"
              value="false"
              variant="outline"
              disabled={pending || getCheckedCount() === 0}
            >
              Save as draft
            </Button>
            <Button type="submit" name="published" value="true" disabled={pending || getCheckedCount() === 0}>
              {pending ? "Posting…" : "Post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}