"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { TargetTable } from "@/components/bridge/target-table";
import { Button } from "@/components/ui/button";
import type { EstimatorSubject as Subject } from "@/lib/bridge/combinations";
import {
  hasAllAssessmentsExceptEot,
  recordedAverage,
  rowsForWeight,
  type SubjectTargets,
} from "@/lib/bridge/target-table";
import { validMark } from "@/lib/bridge/progress";

export function MarkRow({
  subject,
  value,
  onChange,
  targets,
  onTargets,
  goal,
  onGoal,
  disabled,
}: {
  subject: Subject;
  value: string;
  onChange: (name: string, value: string) => void;
  targets: SubjectTargets;
  onTargets: (name: string, next: SubjectTargets) => void;
  goal: string;
  onGoal: (name: string, next: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState<null | "average" | "target">(null);
  const rows = rowsForWeight(subject.weight);
  const goalId = `goal-${subject.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const actual = validMark(value);
  const target = validMark(goal);
  const assessmentsReady = hasAllAssessmentsExceptEot(targets);
  const current = actual ?? recordedAverage(targets)?.value ?? null;
  const feedback =
    assessmentsReady && current !== null && target !== null
      ? { below: current < target, gap: target - current, target }
      : null;

  return (
    <div className="rounded-lg border border-border bg-card transition-colors focus-within:border-primary">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <span className="min-w-32 flex-1 text-sm font-medium text-card-foreground">
          {subject.name}
        </span>
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
          ×{subject.weight}
        </span>
        <span className="flex items-baseline gap-1">
          <input
            disabled={disabled}
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={value}
            onChange={(e) => onChange(subject.name, e.target.value)}
            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
            aria-label={`${subject.name} mark out of 100`}
          />
          <span className="text-xs text-muted-foreground">/100</span>
        </span>
        <Button
          disabled={disabled}
          size="sm"
          variant={open === "average" ? "default" : "outline"}
          aria-label={`${subject.name} average`}
          aria-expanded={open === "average"}
          onClick={() => setOpen(open === "average" ? null : "average")}
        >
          Average
        </Button>
        <Button
          disabled={disabled}
          size="sm"
          variant={open === "target" ? "default" : "outline"}
          aria-label={`${subject.name} target`}
          aria-expanded={open === "target"}
          onClick={() => setOpen(open === "target" ? null : "target")}
        >
          Target
        </Button>
        {target !== null && open !== "target" && (
          <span className="text-xs text-warning">
            Target {target.toFixed(1)}/100
          </span>
        )}
      </div>

      {open === "average" && (
        <div className="px-3 pb-3">
          <TargetTable
            subject={subject.name}
            data={targets}
            onChange={(next) => onTargets(subject.name, next)}
            rows={rows}
          />
        </div>
      )}

      {open === "target" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <label
            htmlFor={goalId}
            className="text-sm text-muted-foreground"
          >
            Enter your targeted marks below
          </label>
          <span className="flex items-center gap-2">
            <input
              id={goalId}
              aria-label={`${subject.name} target mark out of 100`}
              type="text"
              inputMode="decimal"
              placeholder="e.g. 85"
              value={goal}
              onChange={(event) => {
                const next = event.target.value;
                if (
                  next !== "" &&
                  (!/^\d{0,3}(\.\d{0,20})?$/.test(next) ||
                    Number(next) > 100)
                )
                  return;
                onGoal(subject.name, next);
              }}
              className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm font-semibold text-warning outline-none focus:border-ring"
            />
            <span className="text-xs text-muted-foreground">/100</span>
          </span>
        </div>
      )}

      {feedback?.below && (
        <output className="flex items-start gap-2 border-t border-border bg-danger-muted px-4 py-3 text-xs font-bold leading-relaxed text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          You are now {feedback.gap.toFixed(1)} points missing to target{" "}
          {feedback.target.toFixed(1)}.
        </output>
      )}
      {feedback && !feedback.below && (
        <p className="border-t border-border px-4 py-3 text-xs font-bold text-primary">
          You have hit your target of {feedback.target.toFixed(1)}/100 in{" "}
          {subject.name}. Keep it up!
        </p>
      )}
    </div>
  );
}
