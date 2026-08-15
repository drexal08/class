"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setUserRoleAction } from "@/lib/actions/auth-actions";
import type { Role } from "@/generated/prisma/client";
import { displayNameOf, formatDate } from "@/lib/utils";

type DirectoryUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
  createdAt: Date;
  _count: { enrollments: number; createdCourses: number };
};

export function UserDirectory({
  users,
  viewerId,
}: {
  users: DirectoryUser[];
  viewerId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">All users in the institution</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-5 py-3 font-medium">
                User
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Classes
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Joined
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Role
              </th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={user} className="size-8 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {displayNameOf(user)}
                        {user.id === viewerId && (
                          <Badge variant="outline" className="ml-2">
                            You
                          </Badge>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-3 py-3 text-muted-foreground tabular-nums">
                  {user._count.enrollments}
                  {user._count.createdCourses > 0 &&
                    ` · ${user._count.createdCourses} owned`}
                </td>

                <td className="px-3 py-3 text-muted-foreground">
                  {formatDate(user.createdAt)}
                </td>

                <td className="px-5 py-3">
                  <Select
                    defaultValue={user.role}
                    disabled={pending}
                    onValueChange={(role) =>
                      startTransition(async () => {
                        const result = await setUserRoleAction(
                          user.id,
                          role as "ADMIN" | "TEACHER" | "STUDENT",
                        );
                        if (result.error) toast.error(result.error);
                        else toast.success(`Role updated to ${role.toLowerCase()}`);
                      })
                    }
                  >
                    <SelectTrigger size="sm" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STUDENT">Student</SelectItem>
                      <SelectItem value="TEACHER">Teacher</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
