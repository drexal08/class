"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({
  className,
  value,
  max = 100,
  ...props
}: React.ComponentProps<"div"> & {
  value: number;
  max?: number;
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}