import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Empty states carry the instruction, not just the absence. Every one tells the
 * reader what to do next, which is what keeps a new class from feeling broken.
 *
 * The heading level is a prop because the empty state does not always sit in
 * the same place in the document. Under a page heading it is a second-level
 * heading; on a page that has no heading of its own it is the first.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  as: Heading = "h2",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
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
      <Heading
        className={cn(
          "mt-4 font-semibold tracking-tight",
          Heading === "h1" ? "text-2xl" : "text-base",
        )}
      >
        {title}
      </Heading>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
