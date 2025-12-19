import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/modal";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isDanger,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={[
                "inline-flex h-8 w-8 items-center justify-center rounded-lg",
                isDanger ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span>{title}</span>
          </DialogTitle>
        </DialogHeader>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={isDanger ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

