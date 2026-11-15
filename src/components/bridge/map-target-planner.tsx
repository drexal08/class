"use client";

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  mapTargetAverage,
  mapTargetMarksWithEdits,
  validMark,
} from "@/lib/bridge/progress";
import type { WeightedSubject } from "@/lib/bridge/scoring";
import { cn } from "@/lib/utils";

/**
 * The MAP target planner.
 *
 * The student picks their courses from hardest to easiest and the planner
 * spreads the target across them, then lets them nudge a mark and watch the
 * others rebalance. The component stays mounted while it is closed so the
 * course selection survives a trip to the marks and back.
 */
export function MapTargetPlanner({
  open,
  subjects,
  target,
  resetToken,
  onApply,
  onClose,
}: {
  open: boolean;
  subjects: WeightedSubject[];
  /** The overall average the plan has to reach, or null when it is not set. */
  target: number | null;
  /** Bumped whenever the overall target changes, to drop stale edits. */
  resetToken: number;
  onApply: (marks: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState<string[]>([]);
  const [planVisible, setPlanVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState(false);

  const resetEdits = useCallback(() => {
    setEditing(false);
    setEdits({});
    setApplied(false);
  }, []);

  // Opening or closing the planner starts a fresh plan, but keeps the courses
  // the student already picked. React resets the state during render when the
  // flag flips rather than in an effect, so the planner never renders a stale
  // plan for a frame.
  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    setPlanVisible(false);
    resetEdits();
  }

  // A new overall target invalidates the marks the student nudged.
  const [lastResetToken, setLastResetToken] = useState(resetToken);
  if (lastResetToken !== resetToken) {
    setLastResetToken(resetToken);
    resetEdits();
  }

  const selectedSubjects = useMemo(
    () =>
      selection.flatMap((name) => {
        const subject = subjects.find((item) => item.name === name);
        return subject ? [subject] : [];
      }),
    [selection, subjects],
  );

  const plan = useMemo(() => {
    if (target === null) return null;
    const numericEdits: Record<string, number> = {};
    for (const [name, value] of Object.entries(edits)) {
      const mark = validMark(value);
      if (mark !== null) numericEdits[name] = mark;
    }
    return mapTargetMarksWithEdits(selectedSubjects, target, numericEdits);
  }, [edits, selectedSubjects, target]);

  const planAverage = useMemo(() => (plan ? mapTargetAverage(plan) : null), [plan]);
  const awayFromTarget =
    planAverage !== null &&
    target !== null &&
    Math.abs(planAverage - target) > 0.05;

  const toggleCourse = (name: string) => {
    setPlanVisible(false);
    resetEdits();
    setSelection((previous) =>
      previous.includes(name)
        ? previous.filter((item) => item !== name)
        : [...previous, name],
    );
  };

  const setEdit = (name: string, value: string) => {
    if (
      value !== "" &&
      (!/^\d{0,3}(\.\d{0,20})?$/.test(value) || Number(value) > 100)
    )
      return;
    setEdits((all) => ({ ...all, [name]: value }));
    setApplied(false);
  };

  const clearEmptyEdit = (name: string) => {
    setEdits((all) => {
      if (all[name] !== "") return all;
      const next = { ...all };
      delete next[name];
      return next;
    });
  };

  const applyPlan = () => {
    if (!plan) return;
    const marks: Record<string, string> = {};
    for (const row of plan) marks[row.name] = String(Number(row.mark.toFixed(1)));
    setEditing(false);
    setApplied(true);
    onApply(marks);
  };

  if (!open) return null;

  return (
    <section
      aria-label="MAP target planner"
      className="mt-6 rounded-lg border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold leading-tight tracking-tight text-foreground">
            MAP target planner
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Select the courses you want to plan for, starting with your hardest
            course and finishing with your easiest. The planner gives the
            hardest course the lowest mark and the easiest course the highest
            mark.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      {planVisible && plan ? (
        <>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Marks needed in each selected course to reach your target
                overall average
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Order
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Course
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Weight
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    {editing ? "Your mark" : "Mark needed"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                        {row.rank + 1}
                      </span>
                      {row.rank === 0 && (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-primary">
                          Hardest
                        </span>
                      )}
                      {row.rank === plan.length - 1 && plan.length > 1 && (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Easiest
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-foreground">
                      {row.name}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      ×{row.weight}
                    </td>
                    <td className="py-2.5 text-right text-lg font-semibold text-foreground">
                      {editing ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            aria-label={`${row.name} proposed target mark out of 100`}
                            type="text"
                            inputMode="decimal"
                            value={edits[row.name] ?? row.mark.toFixed(1)}
                            onChange={(event) =>
                              setEdit(row.name, event.target.value)
                            }
                            onBlur={() => clearEmptyEdit(row.name)}
                            className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-right text-lg font-semibold text-foreground outline-none focus:border-ring"
                          />
                          <span className="text-xs font-normal text-muted-foreground">
                            /100
                          </span>
                        </span>
                      ) : (
                        <>
                          <span>{row.mark.toFixed(1)}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {" "}
                            /100
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Target overall average across these courses:{" "}
                {target?.toFixed(2) ?? "—"} · Plan weighted result:{" "}
                {planAverage?.toFixed(2) ?? "—"} · marks rounded to one decimal
                place.
              </p>
              {editing && (
                <p className="text-xs text-muted-foreground">
                  Change any mark and the other courses rebalance to keep the
                  weighted result on target.
                </p>
              )}
              {awayFromTarget && (
                <p className="text-xs text-danger">
                  Your edits cannot reach {target?.toFixed(2)} with these
                  courses, so the plan&apos;s weighted result is{" "}
                  {planAverage?.toFixed(2)}.
                </p>
              )}
              {applied && (
                <output className="block text-xs text-foreground">
                  Applied to the target fields for these courses.
                </output>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPlanVisible(false);
                  resetEdits();
                }}
              >
                Change courses
              </Button>
              {editing ? (
                <Button variant="outline" size="sm" onClick={resetEdits}>
                  Cancel edit
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(true);
                    setApplied(false);
                  }}
                  disabled={!plan}
                >
                  Edit
                </Button>
              )}
              <Button size="sm" onClick={applyPlan} disabled={!plan}>
                Apply
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {subjects.map((subject) => {
              const rank = selection.indexOf(subject.name);
              const selected = rank >= 0;
              return (
                <button
                  key={subject.name}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${subject.name}, weight ${subject.weight}${
                    selected ? `, selected as number ${rank + 1}` : ""
                  }`}
                  onClick={() => toggleCourse(subject.name)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-secondary"
                      : "border-border bg-background hover:border-primary/50",
                  )}
                >
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {subject.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ×{subject.weight}
                    </span>
                  </span>
                  {selected && (
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {rank + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {selection.length
              ? `${selection.length} course${
                  selection.length === 1 ? "" : "s"
                } selected · 1 is your hardest course${
                  selection.length > 1
                    ? `, ${selection.length} is your easiest`
                    : ""
                }.`
              : "No courses selected yet. Tap them in order from hardest to easiest."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Target overall average:{" "}
              {target === null ? "not set" : `${target.toFixed(2)} /100`}
            </p>
            <div className="flex flex-wrap gap-2">
              {selection.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelection([]);
                    setPlanVisible(false);
                  }}
                >
                  Clear selection
                </Button>
              )}
              <Button
                size="sm"
                disabled={selection.length === 0 || target === null}
                onClick={() => setPlanVisible(true)}
              >
                Set
              </Button>
            </div>
          </div>
          {target === null && (
            <p className="mt-2 text-xs text-danger">
              Set your target overall average first by clicking the target
              number above.
            </p>
          )}
        </>
      )}
    </section>
  );
}
