import Link from "next/link";

import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { PrimaryNav } from "@/components/shell/primary-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { listNotifications } from "@/lib/data/notifications";
import { siteConfig } from "@/lib/site";
import type { SessionUser } from "@/lib/types";

export async function AppHeader({ user }: { user: SessionUser }) {
  const { items, unread } = await listNotifications();

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

        <PrimaryNav />

        <div className="ml-auto flex items-center gap-1">
          <NotificationsMenu items={items} unread={unread} />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
