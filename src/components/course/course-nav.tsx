"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function CourseNav({
  courseId,
  canManage,
}: {
  courseId: string;
  canManage: boolean;
}) {
  const pathname = usePathname();
  const base = `/course/${courseId}`;

  const tabs = [
    { href: base, label: "Stream" },
    { href: `${base}/classwork`, label: "Classwork" },
    { href: `${base}/people`, label: "People" },
    { href: `${base}/grades`, label: "Grades" },
    ...(canManage
      ? [
          { href: `${base}/attendance`, label: "Attendance" },
          { href: `${base}/reports`, label: "Reports" },
        ]
      : []),
    ...(canManage ? [{ href: `${base}/settings`, label: "Settings" }] : []),
  ];

  return (
    <nav aria-label="Class sections" className="-mb-px flex gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        // Exact match for the stream, prefix match for the rest, so a nested
        // assignment page keeps "Classwork" highlighted.
        const active =
          tab.href === base ? pathname === base : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            // The tabs are always in view, and these routes are dynamic, so
            // the default prefetch only warms the loading shell. Prefetching
            // the full route makes switching tabs feel instant.
            prefetch
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
