"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The join code is the primary way students get into a class, so it is shown
 * plainly and is one click from the clipboard rather than hidden in a menu.
 */
export function ClassCode({
  code,
  courseId,
  size = "default",
  showInviteLink = false,
  className,
}: {
  code: string;
  courseId?: string;
  size?: "sm" | "default" | "lg";
  showInviteLink?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(value: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(kind === "code" ? "Class code copied" : "Invite link copied");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy — select the code and copy it manually");
    }
  }

  const inviteLink =
    courseId && typeof window !== "undefined"
      ? `${window.location.origin}/join/${code}`
      : "";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Class code</span>
        <code
          className={cn(
            "rounded-md border border-border bg-secondary px-2 py-1 font-mono font-semibold tracking-[0.2em] tabular-nums",
            size === "sm" && "text-xs",
            size === "default" && "text-sm",
            size === "lg" && "px-3 py-1.5 text-lg",
          )}
        >
          {code}
        </code>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => void copy(code, "code")}
        aria-label="Copy class code"
      >
        {copied === "code" ? (
          <Check className="size-4 text-success" />
        ) : (
          <Copy className="size-4" strokeWidth={1.75} />
        )}
      </Button>

      {showInviteLink && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => void copy(inviteLink, "link")}
        >
          {copied === "link" ? (
            <Check className="size-4 text-success" />
          ) : (
            <Link2 className="size-4" strokeWidth={1.75} />
          )}
          Invite link
        </Button>
      )}
    </div>
  );
}
