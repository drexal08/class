import { Suspense } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { PrimaryNav } from "@/components/shell/primary-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import { listNotifications } from "@/lib/data/notifications";
import { siteConfig } from "@/lib/site";
import type { SessionUser } from "@/lib/types";

/**
 * The header renders immediately; the notification query streams in behind a
 * Suspense boundary. Waiting for the bell before sending any HTML delayed the
 * first paint of every page for a menu most people open rarely.
 */
export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container-page flex h-16 items-center gap-4">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2.5 rounded-md"
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            L
          </span>
          <span className="hidden text-base font-semibold sm:inline">
            {siteConfig.name}
          </span>
        </Link>

        <PrimaryNav role={user.role} isAdmin={user.isAdmin} />

        <div className="ml-auto flex items-center gap-1">
          <Suspense fallback={<NotificationBellFallback />}>
            <NotificationBell userId={user.id} />
          </Suspense>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}

async function NotificationBell({ userId }: { userId: string }) {
  const { items, unread } = await listNotifications();
  return <NotificationsMenu items={items} unread={unread} userId={userId} />;
}

function NotificationBellFallback() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label="Notifications"
      disabled
    >
      <Bell strokeWidth={1.75} />
    </Button>
  );
}
