"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteAttachmentAction } from "@/lib/actions/attachment-actions";

/**
 * Removes one uploaded file. The server re-checks that the attachment belongs
 * to this course and that the caller uploaded it (or manages the class), so the
 * button is a convenience rather than the authorization boundary.
 */
export function AttachmentRemoveButton({
  courseId,
  attachmentId,
  name,
}: {
  courseId: string;
  attachmentId: string;
  name: string;
}) {
  const router = useRouter();
  const [removing, startRemoving] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 text-muted-foreground hover:text-danger"
      aria-label={`Remove ${name}`}
      disabled={removing}
      onClick={() =>
        startRemoving(async () => {
          const result = await deleteAttachmentAction(courseId, attachmentId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("File removed");
          router.refresh();
        })
      }
    >
      {removing ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
    </Button>
  );
}
