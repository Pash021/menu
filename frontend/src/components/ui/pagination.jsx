import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

function buildPages(page, pageCount) {
  const pages = [];
  const push = (v) => pages.push(v);

  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i += 1) push(i);
    return pages;
  }

  push(1);
  const left = Math.max(2, page - 1);
  const right = Math.min(pageCount - 1, page + 1);

  if (left > 2) push("…");
  for (let i = left; i <= right; i += 1) push(i);
  if (right < pageCount - 1) push("…");
  push(pageCount);

  return pages;
}

export function Pagination({ page, pageCount, onPageChange, className }) {
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount]);
  if (!pageCount || pageCount <= 1) return null;

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <div className="text-sm text-muted-foreground">
        {page} / {pageCount}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, idx) =>
          p === "…" ? (
            <div key={`${p}-${idx}`} className="px-2 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </div>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="icon"
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

