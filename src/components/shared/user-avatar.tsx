import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { accentClasses, accentFor, getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

type UserLike = {
  id?: string;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

/**
 * Initials fall back to a muted accent derived from the user's id, so the same
 * person is always the same colour without anything being stored.
 */
export function UserAvatar({
  user,
  className,
}: {
  user: UserLike;
  className?: string;
}) {
  const initials = getInitials(user.displayName, user.email);
  const accent = accentClasses(accentFor(user.id ?? user.email ?? initials));

  return (
    <Avatar className={cn("size-9", className)}>
      {user.avatarUrl ? (
        <AvatarImage src={user.avatarUrl} alt="" />
      ) : null}
      <AvatarFallback className={accent.avatar}>{initials}</AvatarFallback>
    </Avatar>
  );
}
