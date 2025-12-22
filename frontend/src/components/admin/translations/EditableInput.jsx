import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

export function EditableInput({ value, onChange, placeholder, multiline = false, rows = 4, className, disabled }) {
  if (multiline) {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn("min-h-[110px]", className)}
        disabled={disabled}
      />
    );
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
}

