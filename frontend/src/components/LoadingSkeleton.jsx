import React from "react";
import { cn } from "@/lib/cn";

export function LoadingSkeleton({ className }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

export function LoadingPageSkeleton() {
  return (
    <div className="container py-8">
      <div className="space-y-4">
        <LoadingSkeleton className="h-7 w-56" />
        <LoadingSkeleton className="h-4 w-80" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <LoadingSkeleton className="h-5 w-2/3" />
              <LoadingSkeleton className="mt-3 h-4 w-1/2" />
              <LoadingSkeleton className="mt-6 h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

