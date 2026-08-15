"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notification-actions";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationsMenu({
  items,
  unread,
}: {
  items: NotificationItem[];
  unread: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function open(item: NotificationItem) {
    startTransition(async () => {
      if (!item.readAt) await markNotificationReadAction(item.id);
      if (item.linkPath) router.push(item.linkPath);
      else router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
        >
          <Bell strokeWidth={1.75} />
          {unread > 0 && (
            <span
              className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
              aria-hidden
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsReadAction();
                  router.refresh();
                })
              }
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />

        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            You&rsquo;re all caught up.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  disabled={pending}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none",
                    !item.readAt && "bg-secondary/50",
                  )}
                >
                  <span className="flex items-start gap-2">
                    {!item.readAt && (
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                    )}
                    <span className="text-sm font-medium leading-snug">
                      {item.title}
                    </span>
                  </span>
                  {item.body && (
                    <span className="line-clamp-2 pl-3.5 text-xs text-muted-foreground">
                      {item.body}
                    </span>
                  )}
                  <span className="pl-3.5 text-xs text-muted-foreground">
                    {formatRelative(item.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
