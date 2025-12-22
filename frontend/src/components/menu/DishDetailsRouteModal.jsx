import React, { useEffect } from "react";
import { Flame, Image as ImageIcon, Leaf, Minus, Plus, X } from "lucide-react";
import { motion, useDragControls } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

function useScrollLock(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const scrollY = window.scrollY || 0;
    const prev = {
      overflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflow = prev.overflow;
      document.body.style.overflow = prev.bodyOverflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    };
  }, [enabled]);
}

export function DishDetailsRouteModal({ dish, quantity = 0, onIncrease, onDecrease, onClose, isRoot = false }) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  const dragControls = useDragControls();

  useScrollLock(Boolean(dish));

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!dish) return null;

  const modalMotion = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.18, ease: "easeOut" },
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.22, ease: "easeOut" },
      };

  const sheetMotion = prefersReducedMotion
    ? {
        initial: { y: 0 },
        animate: { y: 0 },
        exit: { y: 0 },
        transition: { duration: 0.18, ease: "easeOut" },
      }
    : {
        initial: { y: 140 },
        animate: { y: 0 },
        exit: { y: 140 },
        transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <motion.div
      className="fixed inset-0 z-[60]"
      initial={modalMotion.initial}
      animate={modalMotion.animate}
      exit={modalMotion.exit}
      transition={modalMotion.transition}
      aria-modal="true"
      role="dialog"
    >
      <motion.button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label={t("common.close")}
        onClick={() => onClose?.()}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />

      <div
        className="absolute inset-0 flex items-end justify-center"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))", paddingTop: "env(safe-area-inset-top)" }}
      >
        <GlassCard
          as={motion.div}
          className="relative w-full max-w-lg mx-4 overflow-hidden"
          style={{ borderRadius: 24 }}
          initial={sheetMotion.initial}
          animate={sheetMotion.animate}
          exit={sheetMotion.exit}
          transition={sheetMotion.transition}
          drag={prefersReducedMotion ? false : "y"}
          dragListener={false}
          dragControls={dragControls}
          dragConstraints={{ top: 0, bottom: 240 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            if (info.offset.y > 140 || info.velocity.y > 1200) onClose?.();
          }}
        >
          <button
            type="button"
            className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-foreground shadow-sm backdrop-blur-md"
            onClick={() => onClose?.()}
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="flex justify-center pt-3"
            onPointerDown={(e) => {
              if (prefersReducedMotion) return;
              dragControls.start(e);
            }}
          >
            <div className="h-1 w-12 rounded-full bg-black/15" />
          </div>

          <div className="grid gap-0 sm:grid-cols-2">
            <div className="relative aspect-square bg-black/5">
              {dish.image_url ? (
                <img
                  src={dish.image_url}
                  alt={dish.name}
                  className="h-full w-full object-contain p-4"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-black/55">
                  <ImageIcon className="h-7 w-7" />
                </div>
              )}
            </div>

            <motion.div
              className="p-5"
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, ease: "easeOut", delay: prefersReducedMotion ? 0 : 0.18 }}
            >
              <div className="text-2xl font-extrabold tracking-tight">{formatMoney(dish.price, dish.currency)}</div>

              <div className="mt-4 text-lg font-extrabold leading-tight">{dish.name}</div>
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

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1 rounded-full border bg-white/60 px-2 py-1.5">
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

                <Button type="button" className="flex-1" onClick={() => onIncrease?.(dish)} disabled={dish.available === false}>
                  {t("public.cart")}
                </Button>
              </div>

              {isRoot ? (
                <div className="mt-4 text-xs text-muted-foreground">{t("public.backToMenu")}</div>
              ) : null}
            </motion.div>
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}
