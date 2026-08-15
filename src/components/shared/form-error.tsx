import { AlertCircle } from "lucide-react";

/** Inline, non-toast error used at the top of every form. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-muted px-3 py-2 text-sm text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
