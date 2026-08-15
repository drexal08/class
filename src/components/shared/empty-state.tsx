import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Empty states carry the instruction, not just the absence. Every one tells the
 * reader what to do next, which is what keeps a new class from feeling broken.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      </span>
      <h3 className="mt-4 font-medium">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
