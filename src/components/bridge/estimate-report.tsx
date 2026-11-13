"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GradeBand } from "@/lib/bridge/grade-bands";
import { cn } from "@/lib/utils";

/**
 * The estimated report: the weighted gauge, the band the average falls into
 * and the button that clears every mark.
 */
export function EstimateReport({
  pct,
  earned,
  maxPoints,
  filled,
  totalSubjects,
  band,
  complete,
  hasGoal,
  onClear,
}: {
  pct: number;
  earned: number;
  maxPoints: number;
  filled: number;
  totalSubjects: number;
  band: GradeBand;
  complete: boolean;
  /** Whether the student set a goal, which replaces the band note. */
  hasGoal: boolean;
  onClear: () => void;
}) {
  const R = 84;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <Card className="p-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
        Estimated report
      </h2>

      <div className="relative mx-auto mt-6 h-52 w-52">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="12"
          />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            className={cn(
              band.ringClass,
              "transition-all duration-500 ease-out",
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-semibold text-foreground">
            {pct.toFixed(2)}
            <span className="text-2xl text-muted-foreground">%</span>
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            {earned.toFixed(0)} / {maxPoints * 100} weighted marks
          </span>
        </div>
      </div>

      {complete && (
        <div className="mt-6 rounded-lg bg-secondary p-4 text-center">
          <p className="text-xl font-semibold text-foreground">{band.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {hasGoal ? "Keep building toward your personal goal." : band.note}
          </p>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {complete
          ? "All subjects filled — this is your full estimate."
          : `${filled} of ${totalSubjects} subjects entered — fill the rest for a complete picture.`}
      </p>

      <Button variant="outline" onClick={onClear} className="mt-5 w-full">
        Clear all marks
      </Button>
    </Card>
  );
}
