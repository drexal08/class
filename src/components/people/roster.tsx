"use client";

import { useTransition } from "react";
import { MicOff, MoreVertical, UserMinus, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { removeMemberAction, setMutedAction } from "@/lib/actions/course-actions";
import { displayNameOf } from "@/lib/utils";

type Member = {
  id: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  muted: boolean;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
};

export function Roster({
  title,
  members,
  courseId,
  canManage,
  ownerId,
}: {
  title: string;
  members: Member[];
  courseId: string;
  canManage: boolean;
  ownerId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <span className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? "person" : "people"}
        </span>
      </div>

      <Card className="mt-3 overflow-hidden">
        {members.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nobody here yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((member) => {
              const isOwner = member.user.id === ownerId;

              return (
                <li
                  key={member.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <UserAvatar user={member.user} className="size-8 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {displayNameOf(member.user)}
                    </p>
                    {/* Emails are only sent to the client for teachers. */}
                    {member.user.email && (
                      <p className="truncate text-xs text-muted-foreground">
                        {member.user.email}
                      </p>
                    )}
                  </div>

                  {isOwner && <Badge variant="outline">Owner</Badge>}
                  {member.muted && (
                    <Badge variant="warning">
                      <MicOff className="size-3" />
                      Muted
                    </Badge>
                  )}

                  {canManage && !isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`Manage ${displayNameOf(member.user)}`}
                          disabled={pending}
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        {member.role === "STUDENT" && (
                          <DropdownMenuItem
                            onSelect={() =>
                              startTransition(async () => {
                                const result = await setMutedAction(
                                  courseId,
                                  member.user.id,
                                  !member.muted,
                                );
                                if (result.error) toast.error(result.error);
                                else
                                  toast.success(
                                    member.muted
                                      ? "Student unmuted"
                                      : "Student muted",
                                  );
                              })
                            }
                          >
                            {member.muted ? <Volume2 /> : <MicOff />}
                            {member.muted ? "Unmute" : "Mute"}
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            startTransition(async () => {
                              const result = await removeMemberAction(
                                courseId,
                                member.user.id,
                              );
                              if (result.error) toast.error(result.error);
                              else toast.success("Removed from class");
                            })
                          }
                        >
                          <UserMinus />
                          Remove from class
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
