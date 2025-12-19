import React from "react";
import { Flame, Leaf, Minus, Plus, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/modal";
import { useI18n } from "@/lib/i18n";

export function DishDetailsModal({ dish, open, onOpenChange, quantity = 0, onIncrease, onDecrease }) {
  const { t } = useI18n();
  if (!dish) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="bottom" className="max-w-2xl p-0 overflow-hidden max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.22, ease: "easeOut" }}>
          <div className="flex justify-center pt-3 sm:hidden">
            <div className="h-1 w-12 rounded-full bg-muted" />
          </div>

          <div className="grid sm:grid-cols-2">
            <div className="bg-muted sm:min-h-full">
              {dish.image_url ? (
                <img
                  src={dish.image_url}
                  alt={dish.name}
                  className="h-56 w-full object-cover sm:h-full"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground sm:h-64">
                  {t("dish.noImage")}
                </div>
              )}
            </div>
            <div className="p-6 pt-4 sm:pt-6">
              <DialogHeader>
                <DialogTitle className="text-xl">{dish.name}</DialogTitle>
              </DialogHeader>

              <div className="mt-2 text-sm text-muted-foreground">{dish.description || "—"}</div>

              <div className="mt-4 flex flex-wrap gap-2">
                {dish.is_spicy ? (
                  <Badge className="gap-1">
                    <Flame className="h-3.5 w-3.5" />
                    {t("dish.badge.spicy")}
                  </Badge>
                ) : null}
                {dish.is_vegan ? (
                  <Badge variant="secondary" className="gap-1">
                    <Leaf className="h-3.5 w-3.5" />
                    {t("dish.badge.vegan")}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-5 rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">{t("dish.priceLabel")}</div>
                <div className="text-2xl font-semibold tracking-tight">{formatMoney(dish.price, dish.currency)}</div>
              </div>

              <DialogFooter className="mt-6">
                <div className="flex w-full items-center justify-between gap-3 sm:justify-start">
                  <div className="inline-flex items-center gap-2 rounded-full border bg-card px-2 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => onDecrease?.(dish)}
                      disabled={quantity <= 0}
                      aria-label="-"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => onIncrease?.(dish)}
                      disabled={dish.available === false}
                      aria-label="+"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button
                    type="button"
                    className="flex-1 gap-2 sm:flex-none"
                    onClick={() => onIncrease?.(dish)}
                    disabled={dish.available === false}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {t("public.cart")}
                  </Button>
                </div>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                  {t("common.close")}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
