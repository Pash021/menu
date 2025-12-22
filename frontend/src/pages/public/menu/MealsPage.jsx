import React, { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { GlassCard } from "@/components/ui/GlassCard";
import { TiltWrapper } from "@/components/ui/TiltWrapper";
import { useProgressiveList } from "@/hooks/useProgressiveList";
import { TopBrandHeader } from "./components/TopBrandHeader";
import shared from "./styles/shared.module.css";
import styles from "./MealsPage.module.css";

const MEAL_BG = ["var(--menu-meal-1)", "var(--menu-meal-2)", "var(--menu-meal-3)", "var(--menu-meal-4)"];
const EMPTY_OBJ = {};

export default function MealsPage({ restaurant, slug, mealsCategory, dishes, backTo, onOpenDish, rightSlot, activeDishId }) {
  const { t } = useI18n();
  const items = useMemo(() => (Array.isArray(dishes) ? dishes : []), [dishes]);
  const visibleCount = useProgressiveList(items.length, mealsCategory?.id, { initial: 10, step: 10 });
  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const categoryHeaderOverrides = mealsCategory?.header_style_overrides || EMPTY_OBJ;
  const restaurantHeaderStyle = restaurant?.header_style || restaurant?.computedHeaderStyle || null;
  const restaurantHeaderOverrides = restaurant?.header_style_overrides || restaurant?.headerStyleOverrides || EMPTY_OBJ;

  const mergedHeaderStyle = useMemo(() => {
    if (restaurantHeaderStyle) return { ...restaurantHeaderStyle, ...categoryHeaderOverrides };
    return mealsCategory?.header_style || null;
  }, [categoryHeaderOverrides, mealsCategory?.header_style, restaurantHeaderStyle]);

  const hasExplicitHeaderColor = Boolean(categoryHeaderOverrides?.headerColor || restaurantHeaderOverrides?.headerColor);
  const headerStyle =
    mergedHeaderStyle && !hasExplicitHeaderColor ? { ...mergedHeaderStyle, headerColor: "#9B5DE5" } : mergedHeaderStyle;

  return (
    <div className={styles.page}>
      <TopBrandHeader
        variant="category"
        restaurant={restaurant}
        fallbackTitle={slug}
        title={t("public.meals")}
        backTo={backTo}
        rightSlot={rightSlot}
        accentColor="#9B5DE5"
        headerStyle={headerStyle}
      />

      <main className={shared.container}>
        {items.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>{t("public.mealsMissing")}</div>
            <div className={styles.emptyText}>{t("public.mealsEmptyDesc")}</div>
          </div>
        ) : (
          <section className={styles.stack} aria-label={mealsCategory?.name || t("public.meals")}>
            {visibleItems.map((dish, idx) => {
              const bg = MEAL_BG[idx % MEAL_BG.length];
              const reverse = idx % 2 === 1;

              return (
                <TiltWrapper
                  key={dish.id}
                  onClick={() => onOpenDish?.(dish)}
                  tabIndex={0}
                  role="button"
                  className={styles.mealTilt}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenDish?.(dish);
                    }
                  }}
                >
                  <GlassCard
                    as="article"
                    className={styles.mealCard}
                    style={{ "--meal-bg": bg }}
                    data-reverse={reverse ? "true" : "false"}
                  >
                  <div className={styles.mealBody}>
                    <div className={styles.price}>{formatMoney(dish?.price || 0, dish?.currency || "")}</div>
                    <div className={styles.name}>{String(dish?.name || "").toUpperCase()}</div>
                    <div className={styles.desc}>{dish?.description || "—"}</div>
                  </div>

                  <div className={styles.mealMedia} aria-hidden="true">
                    {dish?.image_url ? (
                      <img
                        src={dish.image_url}
                        alt={dish?.name || ""}
                        className={styles.image}
                        loading="lazy"
                        decoding="async"
                        width={460}
                        height={460}
                      />
                    ) : (
                      <div className={styles.noImage}>
                        {t("dish.noImage")}
                      </div>
                    )}
                  </div>
                  </GlassCard>
                </TiltWrapper>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
