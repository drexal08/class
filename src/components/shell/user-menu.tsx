"use client";

import Link from "next/link";
import { LogOut, Settings, Shield } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutClient } from "@/lib/firebase/client";
import type { SessionUser } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { displayNameOf } from "@/lib/utils";

export function UserMenu({ user }: { user: SessionUser }) {
  async function signOut() {
    // Clear the Firebase client session first, then the server cookie, so the
    // SDK cannot silently re-authenticate on the next page load.
    await signOutClient().catch(() => undefined);
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.assign("/login");
  }

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

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium">{displayNameOf(user)}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
          <span className="mt-1 text-xs font-normal text-muted-foreground">
            {ROLE_LABELS[user.role]}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>

        {user.role === "ADMIN" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield />
              Admin console
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
