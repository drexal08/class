"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toasts inherit the app's slate tokens rather than sonner's defaults. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-secondary group-[.toast]:text-secondary-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
