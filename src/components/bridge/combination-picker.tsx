"use client";

import type { Combination } from "@/lib/bridge/combinations";
import { cn } from "@/lib/utils";

/** The stream picker: which combination of core subjects the student sits. */
export function CombinationPicker({
  combinations,
  comboCode,
  onSelect,
}: {
  combinations: Combination[];
  comboCode: string;
  onSelect: (code: string) => void;
}) {
  return (
    <section aria-busy={false} className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
        Your combination
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {combinations.map((item) => {
          const active = item.code === comboCode;
          return (
            <button
              key={item.code}
              onClick={() => onSelect(item.code)}
              className={cn(
                "rounded-lg border bg-card p-4 text-left transition-colors",
                active
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-primary/50",
              )}
            >
              <span
                className={cn(
                  "text-2xl font-semibold",
                  active ? "text-primary" : "text-foreground",
                )}
              >
                {item.code}
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                {item.cores.join(" · ")}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
