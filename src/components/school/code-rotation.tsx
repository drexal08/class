"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Key, Shield } from "lucide-react";
import {
  rotateCohortCodeAction,
  rotateCourseCodeAction,
  rotateSchoolCodeActionSimple,
} from "@/lib/actions/cohort-actions";
import type { ActionState } from "@/lib/types";

interface CodeRotationProps {
  schoolId: string;
  cohorts: Array<{
    id: string;
    label: string;
    joinCodes: Array<{ code: string }>;
    courses: Array<{
      id: string;
      name: string;
      kind: string;
      code: string;
    }>;
  }>;
  schoolCode: string | null;
}

function SchoolCodeSection({ schoolCode, rotatingSchool, onRotate }: { schoolCode: string | null; rotatingSchool: boolean; onRotate: () => void }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 mb-4">
        <Key className="h-5 w-5" />
        School join code
      </h3>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-medium">Current school code</p>
          <code className="rounded bg-secondary px-2 py-1 font-mono text-sm">
            {schoolCode ?? "Not set"}
          </code>
        </div>
        <Button
          variant="destructive"
          disabled={rotatingSchool}
          onClick={onRotate}
        >
          {rotatingSchool ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Rotating...
            </>
          ) : (
            <>
              <RotateCcw className="mr-2 h-4 w-4" />
              Rotate school code
            </>
          )}
        </Button>
      </div>
    </section>
  );
}

function CohortCodesSection({ cohorts, rotatingCohort, onRotate }: { cohorts: CodeRotationProps["cohorts"]; rotatingCohort: string | null; onRotate: (cohortId: string) => void }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 mb-4">
        <RotateCcw className="h-5 w-5" />
        Cohort join codes
      </h3>
      <div className="space-y-4">
        {cohorts.map((cohort) => (
          <Card key={cohort.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">{cohort.label}</p>
                <p className="text-sm text-muted-foreground">
                  Code: <code className="font-mono">{cohort.joinCodes[0]?.code ?? "—"}</code>
                </p>
              </div>
              <Button
                variant="destructive"
                disabled={rotatingCohort === cohort.id}
                onClick={() => onRotate(cohort.id)}
              >
                {rotatingCohort === cohort.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rotating...
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Rotate cohort code
                  </>
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function CourseCodesSection({ cohorts, rotatingCourse, onRotate }: { cohorts: CodeRotationProps["cohorts"]; rotatingCourse: string | null; onRotate: (courseId: string, cohortId: string) => void }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 mb-4">
        <RotateCcw className="h-5 w-5" />
        Course join codes
      </h3>
      <div className="space-y-4">
        {cohorts.flatMap((cohort) =>
          cohort.courses.map((course) => (
            <Card key={course.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{course.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {course.kind === "HOMEROOM" ? "Homeroom" : "Subject"} ·{" "}
                    <code className="font-mono">{course.code}</code>
                  </p>
                </div>
                <Button
                  variant="destructive"
                  disabled={rotatingCourse === course.id}
                  onClick={() => onRotate(course.id, cohort.id)}
                >
                  {rotatingCourse === course.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rotating...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Rotate course code
                    </>
                  )}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}

export function CodeRotation({ schoolId, cohorts, schoolCode }: CodeRotationProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rotatingCohort, setRotatingCohort] = useState<string | null>(null);
  const [rotatingCourse, setRotatingCourse] = useState<string | null>(null);
  const [rotatingSchool, setRotatingSchool] = useState(false);

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

  async function handleRotateCohortCode(cohortId: string) {
    setRotatingCohort(cohortId);
    try {
      const result = await rotateCohortCodeAction(cohortId);
      if (result.error) throw new Error(result.error);
      toast.success("Cohort join code rotated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rotate cohort code");
    } finally {
      setRotatingCohort(null);
    }
  }

  async function handleRotateCourseCode(courseId: string, cohortId: string) {
    setRotatingCourse(courseId);
    try {
      const result = await rotateCourseCodeAction(cohortId, courseId);
      if (result.error) throw new Error(result.error);
      toast.success("Course join code rotated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rotate course code");
    } finally {
      setRotatingCourse(null);
    }
  }

  async function handleRotateSchoolCode() {
    setRotatingSchool(true);
    try {
      const result = await rotateSchoolCodeActionSimple(schoolId);
      if (result.error) throw new Error(result.error);
      toast.success("School join code rotated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rotate school code");
    } finally {
      setRotatingSchool(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Join code rotation
        </CardTitle>
        <CardDescription>
          Rotate join codes to invalidate old codes. Old codes will stop working immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SchoolCodeSection schoolCode={schoolCode} rotatingSchool={rotatingSchool} onRotate={handleRotateSchoolCode} />
        <CohortCodesSection cohorts={cohorts} rotatingCohort={rotatingCohort} onRotate={handleRotateCohortCode} />
        <CourseCodesSection cohorts={cohorts} rotatingCourse={rotatingCourse} onRotate={handleRotateCourseCode} />
      </CardContent>
    </Card>
  );
}