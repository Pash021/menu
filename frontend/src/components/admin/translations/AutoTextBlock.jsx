import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export function AutoTextBlock({ label, value, className }) {
  return (
    <div className={cn("rounded-xl border bg-muted/25 p-3", className)}>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">
        {(value || "").trim() ? value : "—"}
      </div>
    </div>
  );
}

