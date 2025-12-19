import React from "react";
import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/lib/theme";

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      closeButton
      richColors
      theme={resolvedTheme}
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "bg-card text-card-foreground border shadow-sm",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-foreground",
        },
      }}
    />
  );
}

