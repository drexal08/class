"use client";

import { Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { validMark } from "@/lib/bridge/progress";

/**
 * The term progress panel: the average the student has today, the average
 * they are aiming for and the planner that spreads that target across their
 * courses.
 */
export function TermProgress({
  subjectCount,
  currentSummary,
  goalSummary,
  overallTarget,
  manualOverallTarget,
  displayedOverallTarget,
  onOverallTargetChange,
  onOpenPlanner,
  complete,
  encouragement,
  saveMessage,
  planner,
}: {
  subjectCount: number;
  currentSummary: { value: number | null; filled: number };
  goalSummary: { value: number | null; filled: number };
  /** The target the student typed in, kept as typed. */
  overallTarget: string;
  manualOverallTarget: number | null;
  displayedOverallTarget: number | null;
  onOverallTargetChange: (next: string, resetPlan?: boolean) => void;
  onOpenPlanner: () => void;
  complete: boolean;
  encouragement: string;
  saveMessage: string;
  /** The MAP planner, mounted even while closed so it keeps its state. */
  planner: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(
      overallTarget ||
        (goalSummary.value === null ? "" : goalSummary.value.toFixed(2)),
    );
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft("");
  };

  const commit = () => {
    const next = draft.trim();
    if (next !== "" && validMark(next) === null) return;
    setEditing(false);
    setDraft("");
    // A committed target invalidates the marks the student nudged in the plan.
    onOverallTargetChange(next, true);
  };

  return (
    <section aria-label="Overall progress" className="mt-10 border-t border-border pt-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Your term progress
      </h2>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Actual overall average
          </p>
          <p className="mt-2 text-4xl font-semibold text-foreground">
            {currentSummary.value === null
              ? "—"
              : currentSummary.value.toFixed(2)}
            <span className="text-lg text-muted-foreground"> /100</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {currentSummary.filled}/{subjectCount} subjects entered
            {currentSummary.filled < subjectCount
              ? " · current marks only"
              : ""}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            Target overall average
          </p>
          {editing ? (
            <form
              className="mt-2 flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                commit();
              }}
            >
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                aria-label="Target overall average out of 100"
                placeholder="e.g. 80"
                value={draft}
                onChange={(event) => {
                  const next = event.target.value;
                  if (
                    next !== "" &&
                    (!/^\d{0,3}(\.\d{0,20})?$/.test(next) ||
                      Number(next) > 100)
                  )
                    return;
                  setDraft(next);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancelEdit();
                }}
                className="w-24 rounded-md border border-input bg-background px-2 py-1 text-right text-2xl font-semibold text-warning outline-none focus:border-ring"
              />
              <span className="text-lg text-muted-foreground">/100</span>
              <Button
                type="submit"
                size="sm"
                disabled={draft.trim() !== "" && validMark(draft) === null}
              >
                Save
              </Button>
              {overallTarget && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setDraft("");
                    onOverallTargetChange("");
                  }}
                >
                  Clear
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              title="Click to set or modify your target overall average"
              className="group mt-2 flex items-baseline gap-2 rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span className="text-4xl font-semibold text-warning">
                {displayedOverallTarget === null
                  ? "—"
                  : displayedOverallTarget.toFixed(2)}
              </span>
              <span className="text-lg text-muted-foreground">/100</span>
              <Pencil
                aria-hidden="true"
                className="size-4 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              />
              <span className="sr-only">Edit target overall average</span>
            </button>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {manualOverallTarget !== null
              ? "Your custom target · click the number to modify"
              : `${goalSummary.filled}/${subjectCount} targets set${
                  goalSummary.filled < subjectCount ? " · partial target" : ""
                }`}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenPlanner}
            className="mt-3"
          >
            Set your MAP target
          </Button>
        </div>
      </div>

      {planner}

      {complete && (
        <div className="mt-6 border-l-2 border-primary pl-4" aria-live="polite">
          <h3 className="text-sm font-semibold text-primary">
            Today&apos;s progress feedback
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground">
            {encouragement}
          </p>
        </div>
      )}
      <output className="mt-4 block text-xs text-muted-foreground">
        {saveMessage}
      </output>
    </section>
  );
}
