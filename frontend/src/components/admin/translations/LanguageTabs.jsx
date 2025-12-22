import React from "react";
import { cn } from "@/lib/cn";

export function LanguageTabs({ languages, value, onChange, className }) {
  return (
    <div
      className={cn(
        "inline-flex w-full flex-wrap items-center gap-1 rounded-xl border bg-muted/20 p-1",
        className,
      )}
      role="tablist"
      aria-label="Languages"
    >
      {languages.map((l) => {
        const active = l.code === value;
        return (
          <button
            key={l.code}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-background/60",
            )}
            onClick={() => onChange?.(l.code)}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

