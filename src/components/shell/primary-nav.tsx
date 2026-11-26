"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  CalendarCheck,
  CalendarDays,
  GraduationCap,
  LayoutGrid,
  ListTodo,
  ChevronDown,
  ChevronRight,
  Search,
  BookOpen,
  Users,
  Settings,
  Shield,
  Keyboard,
  Command,
} from "lucide-react";

import type { Role } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { signOutClient } from "@/lib/firebase/client";
import type { SessionUser } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { displayNameOf } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Classes", icon: LayoutGrid },
  { href: "/todo", label: "To-do", icon: ListTodo },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;

const STUDENT_LINKS = [
  { href: "/grades", label: "Grades", icon: GraduationCap },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
] as const;

// Mega menu items for courses
const COURSE_QUICK_LINKS = [
  { href: "/dashboard", label: "All Classes", icon: LayoutGrid, description: "View all your classes" },
  { href: "/todo", label: "To-do List", icon: ListTodo, description: "Work due across all classes" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, description: "Schedule and deadlines" },
] as const;

const STUDENT_COURSE_LINKS = [
  { href: "/grades", label: "Grades", icon: GraduationCap, description: "View grades and reports" },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, description: "Your attendance record" },
] as const;

const TEACHER_COURSE_LINKS = [
  { href: "/dashboard", label: "My Classes", icon: LayoutGrid, description: "Classes you teach" },
  { href: "/todo", label: "To Review", icon: ListTodo, description: "Submissions to grade" },
] as const;

export function PrimaryNav({ role, isAdmin, user }: { role: Role; isAdmin: boolean; user: SessionUser }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The estimator is a student tool; admins keep access so they can inspect it.
  const showBridge = role === "STUDENT" || isAdmin;
  // Marks and attendance are the student's own record. Teachers reach the same
  // data per class, so these global entries would be empty for them.
  const links = role === "STUDENT" || isAdmin ? [...LINKS, ...STUDENT_LINKS] : LINKS;

  // Close mega menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (megaMenuRef.current && !megaMenuRef.current.contains(event.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setMegaMenuOpen(false);
      }
      if (sidebarOpen) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sidebarOpen]);

  // Keyboard shortcut: Cmd/Ctrl + K for search, Cmd/Ctrl + B for sidebar
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        // Focus search or open command palette
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "b") {
        event.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
      if (event.key === "Escape") {
        setMegaMenuOpen(false);
        setSidebarOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  async function signOut() {
    await signOutClient().catch(() => undefined);
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.assign("/login");
  }

  return (
    <>
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? <ChevronRight className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
      </Button>

      {/* Desktop navigation */}
      <nav aria-label="Main" className="hidden lg:flex items-center gap-1">
        {links.map((link) => {
          const active =
            pathname === link.href ||
            (link.href === "/dashboard" && pathname.startsWith("/course"));

          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <link.icon className="size-4" strokeWidth={1.75} aria-hidden />
              <span>{link.label}</span>
            </Link>
          );
        })}

        {/* Courses Mega Menu */}
        <div className="relative" ref={megaMenuRef}>
          <Button
            ref={triggerRef}
            variant="ghost"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              megaMenuOpen
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
            onClick={() => setMegaMenuOpen(!megaMenuOpen)}
            aria-expanded={megaMenuOpen}
            aria-haspopup="true"
          >
            <BookOpen className="size-4" strokeWidth={1.75} aria-hidden />
            <span>Courses</span>
            <ChevronDown className={cn("size-3.5 transition-transform", megaMenuOpen && "rotate-180")} />
          </Button>

          {megaMenuOpen && (
            <div
              className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-card shadow-lg p-3"
              role="menu"
            >
              <div className="space-y-3">
                {/* Quick Links */}
                <div>
                  <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Quick Links
                  </p>
                  {COURSE_QUICK_LINKS.map((link) => {
                    const active = pathname === link.href || (link.href === "/dashboard" && pathname.startsWith("/course"));
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        prefetch
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                          active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                        onClick={() => setMegaMenuOpen(false)}
                      >
                        <link.icon className="size-4" strokeWidth={1.75} aria-hidden />
                        <div className="flex-1 text-left">
                          <p className="font-medium">{link.label}</p>
                          <p className="text-xs text-muted-foreground">{link.description}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {role === "STUDENT" || isAdmin ? (
                  <>
                    <div className="border-t border-border pt-3">
                      <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Student Tools
                      </p>
                      {STUDENT_COURSE_LINKS.map((link) => {
                        const active = pathname === link.href;
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            prefetch
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}
                            onClick={() => setMegaMenuOpen(false)}
                          >
                            <link.icon className="size-4" strokeWidth={1.75} aria-hidden />
                            <div className="flex-1 text-left">
                              <p className="font-medium">{link.label}</p>
                              <p className="text-xs text-muted-foreground">{link.description}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="border-t border-border pt-3">
                      <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Teacher Tools
                      </p>
                      {TEACHER_COURSE_LINKS.map((link) => {
                        const active = pathname === link.href || (link.href === "/dashboard" && pathname.startsWith("/course"));
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            prefetch
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}
                            onClick={() => setMegaMenuOpen(false)}
                          >
                            <link.icon className="size-4" strokeWidth={1.75} aria-hidden />
                            <div className="flex-1 text-left">
                              <p className="font-medium">{link.label}</p>
                              <p className="text-xs text-muted-foreground">{link.description}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}

                {showBridge && (
                  <div className="border-t border-border pt-3">
                    <Link
                      href="/bridge"
                      prefetch
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                        pathname.startsWith("/bridge")
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                      onClick={() => setMegaMenuOpen(false)}
                    >
                      <Calculator className="size-4" strokeWidth={1.75} aria-hidden />
                      <div className="flex-1 text-left">
                        <p className="font-medium">CLA Bridge</p>
                        <p className="text-xs text-muted-foreground">Estimate your CLA level</p>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        >
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-semibold">Navigation</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close navigation"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-2" aria-label="Mobile navigation">
              {links.map((link) => {
                const active =
                  pathname === link.href ||
                  (link.href === "/dashboard" && pathname.startsWith("/course"));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors",
                      active
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <link.icon className="size-5" strokeWidth={1.75} aria-hidden />
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              <div className="border-t border-border pt-3 mt-3">
                {showBridge && (
                  <Link
                    href="/bridge"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <Calculator className="size-5" strokeWidth={1.75} aria-hidden />
                    <span>CLA Bridge</span>
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* User Menu with Keyboard Shortcuts */}
      <UserMenuWithShortcuts user={user} onSignOut={signOut} />
    </>
  );
}

function UserMenuWithShortcuts({ user, onSignOut }: { user: SessionUser; onSignOut: () => Promise<void> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Account menu"
        >
          <UserAvatar user={user} className="size-8" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium">{displayNameOf(user)}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
          <span className="mt-1 text-xs font-normal text-muted-foreground">
            {ROLE_LABELS[user.role]}
            {user.isAdmin ? " · Admin" : ""}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
            <DropdownMenuShortcut>
              <kbd className="hidden sm:inline-flex"><Command /> ,</kbd>
            </DropdownMenuShortcut>
          </Link>
        </DropdownMenuItem>

        {user.isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield className="h-4 w-4" />
              <span>Admin Console</span>
              <DropdownMenuShortcut>
                <kbd className="hidden sm:inline-flex">⌘ ⇧ A</kbd>
              </DropdownMenuShortcut>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <div className="px-2 py-1 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px] font-mono">
            ⌘ K
          </kbd>
          <span className="ml-2">Search</span>
        </div>
        <div className="px-2 py-1 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px] font-mono">
            ⌘ B
          </kbd>
          <span className="ml-2">Toggle Sidebar</span>
        </div>
        <div className="px-2 py-1 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px] font-mono">
            ?
          </kbd>
          <span className="ml-2">Keyboard Shortcuts</span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onSelect={() => void onSignOut()}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { LogOut } from "lucide-react";