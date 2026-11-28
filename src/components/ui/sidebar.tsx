"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
  Home,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";
import type { Role } from "@/generated/prisma/client";
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

interface SidebarProps {
  user: SessionUser;
  isAdmin: boolean;
  role: Role;
}

export function Sidebar({ user, isAdmin, role }: SidebarProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = React.useState(false);
  const megaMenuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const showBridge = role === "STUDENT" || isAdmin;
  const links = role === "STUDENT" || isAdmin ? [...LINKS, ...STUDENT_LINKS] : LINKS;

  // Close mega menu on outside click
  React.useEffect(() => {
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

  // Keyboard shortcuts
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
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
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col h-[calc(100vh-4rem)] fixed lg:static top-16 z-30 border-r border-border bg-card transition-all duration-200",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
        aria-label="Main navigation"
      >
        {/* Sidebar header with collapse toggle */}
        {!sidebarCollapsed && (
          <div className="flex items-center justify-between h-14 px-4 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Navigation</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main navigation">
          {/* Main navigation links */}
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
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  sidebarCollapsed
                    ? "justify-center px-2"
                    : "",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
                title={sidebarCollapsed ? link.label : undefined}
              >
                <link.icon className={cn("size-5 flex-shrink-0", sidebarCollapsed && "mx-auto")} strokeWidth={1.75} aria-hidden />
                {!sidebarCollapsed && <span className="truncate">{link.label}</span>}
              </Link>
            );
          })}

          {/* Courses Mega Menu */}
          <div className="relative" ref={megaMenuRef}>
            <Button
              ref={triggerRef}
              variant={megaMenuOpen ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                sidebarCollapsed ? "justify-center px-2" : "",
                megaMenuOpen
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              onClick={() => setMegaMenuOpen(!megaMenuOpen)}
              aria-expanded={megaMenuOpen}
              aria-haspopup="true"
              title={sidebarCollapsed ? "Courses" : undefined}
            >
              <BookOpen className={cn("size-5 flex-shrink-0", sidebarCollapsed && "mx-auto")} strokeWidth={1.75} aria-hidden />
              {!sidebarCollapsed && (
                <>
                  <span className="truncate flex-1">Courses</span>
                  <ChevronDown className={cn("size-4 transition-transform", megaMenuOpen && "rotate-180")} />
                </>
              )}
            </Button>

            {megaMenuOpen && !sidebarCollapsed && (
              <div
                className="absolute left-full top-0 z-50 ml-2 w-80 rounded-lg border border-border bg-card shadow-xl p-3"
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
                            active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
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

                  {(role === "STUDENT" || isAdmin) ? (
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
                                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
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
                                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
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
                            ? "bg-primary/10 text-primary"
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

        {/* Sidebar footer with collapse toggle when collapsed */}
        {sidebarCollapsed && (
          <div className="p-3 border-t border-border">
            <Button
              variant="ghost"
              size="icon"
              className="w-full justify-center"
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar Overlay */}
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
                <X className="h-5 w-5" />
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
                        ? "bg-primary/10 text-primary"
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

async function signOut() {
  await signOutClient().catch(() => undefined);
  await fetch("/api/auth/session", { method: "DELETE" });
  window.location.assign("/login");
}

import { LogOut } from "lucide-react";