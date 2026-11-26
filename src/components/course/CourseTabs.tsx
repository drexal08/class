"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CourseTabsProps {
  courseId: string;
}

const tabs = [
  { href: "/", label: "Stream" },
  { href: "/classwork", label: "Classwork" },
  { href: "/people", label: "People" },
  { href: "/grades", label: "Grades" },
] as const;

export function CourseTabs({ courseId }: CourseTabsProps) {
  const pathname = usePathname();
  const basePath = `/course/${courseId}`;

  return (
    <nav className="flex gap-1 bg-card border-b border-border" role="tablist" aria-label="Course sections">
      {tabs.map((tab) => {
        const href = `${basePath}${tab.href}`;
        const isActive =
          tab.href === "/" ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={tab.label}
            href={href}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.label.toLowerCase()}`}
            id={`tab-${tab.label.toLowerCase()}`}
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              isActive
                ? "text-foreground border-b-2 border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}