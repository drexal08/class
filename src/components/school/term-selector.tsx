import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Term pills. A plain link per term keeps this a server component and keeps
 * the selected term in the URL, so a refresh shows the same gradebook.
 */
export function TermSelector({
  terms,
  currentId,
  basePath,
}: {
  terms: Array<{ id: string; name: string; academicYear: string }>;
  currentId: string | null;
  basePath: string;
}) {
  if (terms.length <= 1) return null;

  return (
    <nav aria-label="Term" className="flex flex-wrap gap-2">
      {terms.map((term) => {
        const active = term.id === currentId;
        return (
          <Link
            key={term.id}
            href={`${basePath}?term=${term.id}`}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              active
                ? "border-foreground bg-secondary font-medium text-foreground"
                : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {term.name}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {term.academicYear}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
