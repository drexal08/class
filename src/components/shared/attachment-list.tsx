import { Paperclip } from "lucide-react";

import { AttachmentRemoveButton } from "@/components/shared/attachment-remove-button";
import { formatFileSize } from "@/lib/utils";

export type AttachmentSummary = {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  /** Present when the query selected it; used to show the remove control. */
  uploadedById?: string | null;
};

export function AttachmentList({
  attachments,
  emptyLabel,
  courseId,
  viewerId,
  canManage = false,
}: {
  attachments: AttachmentSummary[];
  emptyLabel?: string;
  courseId?: string;
  viewerId?: string;
  canManage?: boolean;
}) {
  if (attachments.length === 0) {
    return emptyLabel ? (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    ) : null;
  }

  return (
    <ul className="space-y-2">
      {attachments.map((file) => {
        const canRemove = Boolean(
          courseId &&
            viewerId &&
            (canManage || file.uploadedById === viewerId),
        );

        return (
          <li key={file.id} className="flex items-center gap-1">
            {/* Always via the authorised route — a stored signed URL would expire,
                and a public bucket URL would expose student work to anyone. */}
            <a
              href={`/api/files/${file.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <Paperclip
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="truncate">{file.name}</span>
              {file.size ? (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              ) : null}
            </a>

            {canRemove && courseId && (
              <AttachmentRemoveButton
                courseId={courseId}
                attachmentId={file.id}
                name={file.name}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
