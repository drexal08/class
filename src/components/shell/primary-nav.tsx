"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutGrid, ListTodo } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Classes", icon: LayoutGrid },
  { href: "/todo", label: "To-do", icon: ListTodo },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex items-center gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const active =
          pathname === link.href ||
          (link.href === "/dashboard" && pathname.startsWith("/course"));

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <link.icon className="size-4" strokeWidth={1.75} aria-hidden />
            <span className="hidden sm:inline">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
