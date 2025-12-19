import React from "react";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export function DishCard({ dish, onOpen, renderAction, className }) {
  const { t } = useI18n();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(dish)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen?.(dish);
      }}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-2xl border bg-card/80 p-3 text-left shadow-sm backdrop-blur transition-colors hover:border-muted-foreground/25 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]",
        className
      )}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
        {dish.image_url ? (
          <img
            src={dish.image_url}
            alt={dish.name}
            className="h-full w-full object-cover"
            loading="lazy"
            width={128}
            height={128}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{dish.name}</div>
            {dish.description ? (
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{dish.description}</div>
            ) : null}
          </div>
          <div className="shrink-0 text-sm font-semibold">{formatMoney(dish.price, dish.currency)}</div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {dish.is_spicy ? <Badge>{t("dish.badge.spicy")}</Badge> : null}
          {dish.is_vegan ? <Badge variant="secondary">{t("dish.badge.vegan")}</Badge> : null}
          {dish.available === false ? <Badge variant="muted">{t("dish.badge.unavailable")}</Badge> : null}
        </div>
      </div>

      {typeof renderAction === "function" ? (
        <div className="absolute right-3 top-3">{renderAction(dish)}</div>
      ) : null}
    </div>
  );
}
