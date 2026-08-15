import { Paperclip } from "lucide-react";

import { formatFileSize } from "@/lib/utils";

export type AttachmentSummary = {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  size: number | null;
};

export function AttachmentList({
  attachments,
  emptyLabel,
}: {
  attachments: AttachmentSummary[];
  emptyLabel?: string;
}) {
  if (attachments.length === 0) {
    return emptyLabel ? (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    ) : null;
  }

  return (
    <ul className="space-y-2">
      {attachments.map((file) => (
        <li key={file.id}>
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
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
        </li>
      ))}
    </ul>
  );
}
